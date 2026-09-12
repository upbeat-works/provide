import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { http, HttpResponse } from 'msw';
import type { ScenarioDetailsResponse } from '../catalog/contracts';
import { api } from '../index';
import { instances } from '../instances';
import { createTestEnv, emptyIxmp4Handlers, listEnvelope, server, tabulateEnvelope, testInstance } from '../test-helpers';
import type { Ixmp4Instance } from '../types';

const initialInstanceCount = instances.length;

afterEach(() => {
  instances.splice(initialInstanceCount);
});

function useSource(instance: Ixmp4Instance, scenario: string, median: number, yearEnd: 2100 | 2300) {
  server.use(
    http.patch(`${instance.url}/runs/`, () =>
      HttpResponse.json(
        listEnvelope([
          {
            id: 1,
            model: { name: 'Impact model' },
            scenario: { name: scenario },
            version: 1,
            is_default: true,
          },
        ])
      )
    ),
    http.patch(`${instance.url}/iamc/datapoints/`, async ({ request }) => {
      const body = (await request.json()) as { region?: { name?: string }; variable?: { name?: string } };
      if (!body.variable?.name?.startsWith('Global Mean Temperature|')) {
        return HttpResponse.json({ error: 'Impact data are not available' }, { status: 500 });
      }
      const value = body.variable?.name?.split('|').at(-1);
      const byPercentile: Record<string, number> = {
        '10th Percentile': median + 0.2,
        '50th Percentile': median,
        '90th Percentile': median - 0.2,
      };
      return HttpResponse.json(
        tabulateEnvelope(
          ['model', 'scenario', 'region', 'unit', '2020', String(yearEnd)],
          [['FaIR', scenario, 'World', '°C', byPercentile[value ?? ''] - 0.5, byPercentile[value ?? '']]]
        )
      );
    }),
    ...emptyIxmp4Handlers(instance)
  );
}

describe('GET /api/methodology-scenarios', () => {
  test('returns one technical detail entry per scenario and instance', async () => {
    const second: Ixmp4Instance = {
      slug: 'second-source',
      name: 'Second source',
      url: 'https://second.example/v1/second-source',
      managerUrl: 'https://second.example/v1',
    };
    instances.push(second);
    useSource(testInstance, 'Shared Scenario', 1.6, 2100);
    useSource(second, 'Shared Scenario', 2.4, 2300);

    const res = await api.request('/api/methodology-scenarios', {}, await createTestEnv());
    const json = (await res.json()) as ScenarioDetailsResponse[];

    expect(res.status).toBe(200);
    expect(json).toHaveLength(2);
    expect(json.map(({ id, instance }) => ({ id, instance }))).toEqual([
      { id: 'Shared Scenario', instance: testInstance.slug },
      { id: 'Shared Scenario', instance: second.slug },
    ]);
    expect(json.map(({ gmt }) => gmt?.data.at(-1)?.[1])).toEqual([1.6, 2.4]);
    expect(json.map(({ yearStart, yearStep, yearEnd }) => ({ yearStart, yearStep, yearEnd }))).toEqual([
      { yearStart: 2020, yearStep: 80, yearEnd: 2100 },
      { yearStart: 2020, yearStep: 280, yearEnd: 2300 },
    ]);
    for (const entry of json) {
      expect(Object.keys(entry).sort()).toEqual(['characteristics', 'gmt', 'id', 'instance', 'label', 'yearEnd', 'yearStart', 'yearStep']);
      expect(entry).not.toHaveProperty('description');
      expect(entry).not.toHaveProperty('uid');
    }
  });

  test('excludes runs without a GMT timeframe, including Today', async () => {
    server.use(
      http.patch(`${testInstance.url}/runs/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 1, model: { name: 'M' }, scenario: { name: 'Valid' }, version: 1, is_default: true },
            { id: 2, model: { name: 'M' }, scenario: { name: 'Today' }, version: 1, is_default: true },
          ])
        )
      ),
      http.patch(`${testInstance.url}/iamc/datapoints/`, async ({ request }) => {
        const body = (await request.json()) as {
          scenario?: { name__ilike?: string };
          variable?: { name?: string };
        };
        if (body.variable) {
          return HttpResponse.json(tabulateEnvelope(['model', 'scenario', 'unit', '2100'], [['FaIR', 'Valid', '°C', 1.5]]));
        }
        if (body.scenario?.name__ilike === 'Valid') {
          return HttpResponse.json(tabulateEnvelope(['model', 'scenario', '2020', '2100'], [['M', 'Valid', 1, 2]]));
        }
        return HttpResponse.json(tabulateEnvelope([], []));
      })
    );

    const res = await api.request('/api/methodology-scenarios', {}, await createTestEnv());
    const json = (await res.json()) as ScenarioDetailsResponse[];

    expect(res.status).toBe(200);
    expect(json.map(({ id }) => id)).toEqual(['Valid']);
  });

  test('logs the failed instance without exposing source details', async () => {
    const errorLog = spyOn(console, 'error').mockImplementation(() => {});
    try {
      server.use(http.patch(`${testInstance.url}/runs/`, () => HttpResponse.json({ private: 'source detail' }, { status: 503 })));

      const res = await api.request('/api/methodology-scenarios', {}, await createTestEnv());

      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'Scenario sources unavailable' });
      expect(errorLog).toHaveBeenCalledWith('Scenario sources unavailable', {
        instance: testInstance.slug,
        errorType: 'Error',
      });
    } finally {
      errorLog.mockRestore();
    }
  });
});
