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

function useScenarioSource() {
  server.use(
    http.patch(`${testInstance.url}/runs/`, () =>
      HttpResponse.json(
        listEnvelope([
          {
            id: 1,
            model: { name: 'Impact model' },
            scenario: { name: 'CurPol' },
            version: 1,
            is_default: true,
          },
        ])
      )
    ),
    http.patch(`${testInstance.url}/iamc/datapoints/`, async ({ request }) => {
      const body = (await request.json()) as { variable?: { name?: string } };
      const value = body.variable?.name?.split('|').at(-1);
      const values: Record<string, number[]> = {
        '10th Percentile': [1.5, 2.2, 2.0],
        '50th Percentile': [1.3, 2.0, 1.6],
        '90th Percentile': [1.1, 1.8, 1.4],
      };
      return HttpResponse.json(tabulateEnvelope(['model', 'scenario', 'region', 'unit', '2020', '2060', '2100'], [['FaIR', 'curpol', 'World', '°C', ...(values[value ?? ''] ?? [])]]));
    })
  );
}

describe('GET /api/scenario-details/:id', () => {
  test('requires an instance', async () => {
    const res = await api.request('/api/scenario-details/CurPol', {}, await createTestEnv());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'instance is required' });
  });

  test('rejects an unknown instance', async () => {
    const res = await api.request('/api/scenario-details/CurPol?instance=unknown', {}, await createTestEnv());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Unknown instance: unknown' });
  });

  test.each(['*', '?'])('rejects the wildcard scenario id %s before contacting the selected source', async (id) => {
    let sourceRequests = 0;
    server.use(
      http.post(`${testInstance.managerUrl}/token/obtain/`, () => {
        sourceRequests++;
        return HttpResponse.json({ access: 'fake-token' });
      }),
      http.patch(`${testInstance.url}/runs/`, () => {
        sourceRequests++;
        return HttpResponse.json(listEnvelope([]));
      }),
      http.patch(`${testInstance.url}/iamc/datapoints/`, () => {
        sourceRequests++;
        return HttpResponse.json(tabulateEnvelope([], []));
      })
    );

    const res = await api.request(`/api/scenario-details/${encodeURIComponent(id)}?instance=${testInstance.slug}`, {}, await createTestEnv());

    expect(sourceRequests).toBe(0);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: `Invalid scenario id: ${id}` });
  });

  test.each(['Pathway (A)', 'Pathway_A', "O'Neil", 'Pathway+1'])('accepts the source scenario id %s', async (id) => {
    server.use(
      http.patch(`${testInstance.url}/runs/`, () => HttpResponse.json(listEnvelope([{ id: 1, model: { name: 'M' }, scenario: { name: id }, version: 1, is_default: true }]))),
      http.patch(`${testInstance.url}/iamc/datapoints/`, async ({ request }) => {
        const body = (await request.json()) as { variable?: { name?: string } };
        if (body.variable) {
          return HttpResponse.json({ error_name: 'variable_not_found', message: 'No GMT variable' }, { status: 404 });
        }
        return HttpResponse.json(tabulateEnvelope(['model', 'scenario', '2020', '2100'], [['M', id, 1, 2]]));
      })
    );

    const res = await api.request(`/api/scenario-details/${encodeURIComponent(id)}?instance=${testInstance.slug}`, {}, await createTestEnv());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id, instance: testInstance.slug });
  });

  test('matches within the selected source without case-sensitive IDs', async () => {
    useScenarioSource();
    const res = await api.request(`/api/scenario-details/CURPOL?instance=${testInstance.slug}`, {}, await createTestEnv());
    const json = (await res.json()) as ScenarioDetailsResponse;

    expect(res.status).toBe(200);
    expect(json).toEqual({
      id: 'CurPol',
      label: 'CurPol',
      instance: testInstance.slug,
      yearStart: 2020,
      yearStep: 40,
      yearEnd: 2100,
      gmt: {
        data: [
          [1.1, 1.3, 1.5],
          [1.8, 2, 2.2],
          [1.4, 1.6, 2],
        ],
        yearStart: 2020,
        yearStep: 40,
        yearEnd: 2100,
        model: 'FaIR',
        unit: '°C',
      },
      characteristics: {
        gmtPeak: [2, 2060],
        gmt2100: 1.6,
        coolingRateAfterPeak: 0.1,
      },
    });
    expect(json).not.toHaveProperty('description');
    expect(json).not.toHaveProperty('ScenarioCharacteristics');
    expect(json.gmt).not.toHaveProperty('scenario');
    expect(json.gmt).not.toHaveProperty('characteristics');
  });

  test('returns nullable GMT triples for an interior gap', async () => {
    server.use(
      http.patch(`${testInstance.url}/runs/`, () => HttpResponse.json(listEnvelope([{ id: 1, model: { name: 'M' }, scenario: { name: 'Gap' }, version: 1, is_default: true }]))),
      http.patch(`${testInstance.url}/iamc/datapoints/`, async ({ request }) => {
        const body = (await request.json()) as { variable?: { name?: string } };
        if (!body.variable) {
          return HttpResponse.json(tabulateEnvelope(['model', 'scenario', '2020', '2030', '2040'], [['M', 'Gap', 1, 2, 3]]));
        }
        const value = body.variable.name?.split('|').at(-1);
        const values: Record<string, Array<number | null>> = {
          '10th Percentile': [1.4, null, 1.5],
          '50th Percentile': [1.2, null, 1.3],
          '90th Percentile': [1, null, 1.1],
        };
        return HttpResponse.json(tabulateEnvelope(['model', 'scenario', 'region', 'unit', '2020', '2030', '2040'], [['FaIR', 'Gap', 'World', '°C', ...(values[value ?? ''] ?? [])]]));
      })
    );

    const res = await api.request(`/api/scenario-details/Gap?instance=${testInstance.slug}`, {}, await createTestEnv());
    const json = (await res.json()) as ScenarioDetailsResponse;

    expect(res.status).toBe(200);
    expect(json.gmt?.data).toEqual([
      [1, 1.2, 1.4],
      [null, null, null],
      [1.1, 1.3, 1.5],
    ]);
  });

  test('returns 404 when the source has neither a run nor GMT detail', async () => {
    const res = await api.request(`/api/scenario-details/Missing?instance=${testInstance.slug}`, {}, await createTestEnv());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Scenario not found: Missing' });
  });

  test('scopes run, timeframe, and GMT requests to the requested scenario', async () => {
    let variableRequests = 0;
    let runFilter: unknown;
    const datapointFilters: unknown[] = [];
    server.use(
      http.patch(`${testInstance.url}/runs/`, async ({ request }) => {
        runFilter = await request.json();
        return HttpResponse.json(listEnvelope([{ id: 1, model: { name: 'M' }, scenario: { name: 'Scoped' }, version: 1, is_default: true }]));
      }),
      http.patch(`${testInstance.url}/iamc/variables/`, () => {
        variableRequests++;
        return HttpResponse.json(listEnvelope([]));
      }),
      http.patch(`${testInstance.url}/iamc/datapoints/`, async ({ request }) => {
        const body = (await request.json()) as { variable?: { name?: string } };
        datapointFilters.push(body);
        if (!body.variable) {
          return HttpResponse.json(tabulateEnvelope(['model', 'scenario', '2020', '2030'], [['M', 'Scoped', 1, 2]]));
        }
        return HttpResponse.json(tabulateEnvelope(['model', 'scenario', 'unit', '2020', '2030'], [['FaIR', 'Scoped', '°C', 1, 2]]));
      })
    );

    const res = await api.request(`/api/scenario-details/Scoped?instance=${testInstance.slug}`, {}, await createTestEnv());

    expect(res.status).toBe(200);
    expect(variableRequests).toBe(0);
    expect(runFilter).toMatchObject({ scenario: { name__ilike: 'Scoped' } });
    expect(datapointFilters).toHaveLength(4);
    for (const filter of datapointFilters) {
      expect(filter).toMatchObject({ scenario: { name__ilike: 'Scoped' } });
    }
  });

  test('returns 404 instead of inventing a timeframe for an empty run', async () => {
    server.use(http.patch(`${testInstance.url}/runs/`, () => HttpResponse.json(listEnvelope([{ id: 1, model: { name: 'M' }, scenario: { name: 'Empty' }, version: 1, is_default: true }]))));

    const res = await api.request(`/api/scenario-details/Empty?instance=${testInstance.slug}`, {}, await createTestEnv());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Scenario not found: Empty' });
  });

  test('returns run details when the source has no GMT variable', async () => {
    server.use(
      http.patch(`${testInstance.url}/runs/`, () => HttpResponse.json(listEnvelope([{ id: 1, model: { name: 'M' }, scenario: { name: 'Impact only' }, version: 1, is_default: true }]))),
      http.patch(`${testInstance.url}/iamc/datapoints/`, async ({ request }) => {
        const body = (await request.json()) as { variable?: { name?: string } };
        if (body.variable) {
          return HttpResponse.json({ error_name: 'variable_not_found', message: 'No GMT variable' }, { status: 404 });
        }
        return HttpResponse.json(tabulateEnvelope(['model', 'scenario', '2020', '2100'], [['M', 'Impact only', 1, 2]]));
      })
    );

    const res = await api.request(`/api/scenario-details/Impact%20only?instance=${testInstance.slug}`, {}, await createTestEnv());
    const json = (await res.json()) as ScenarioDetailsResponse;

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      id: 'Impact only',
      yearStart: 2020,
      yearStep: 80,
      yearEnd: 2100,
      characteristics: {},
    });
    expect(json).not.toHaveProperty('gmt');
  });

  test('returns 502 when a selected-source timeframe request fails', async () => {
    const errorLog = spyOn(console, 'error').mockImplementation(() => {});
    try {
      server.use(
        http.patch(`${testInstance.url}/runs/`, () => HttpResponse.json(listEnvelope([{ id: 1, model: { name: 'M' }, scenario: { name: 'Broken' }, version: 1, is_default: true }]))),
        http.patch(`${testInstance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([{ id: 1, name: 'Indicator|Period|Annual|Area|50th Percentile' }]))),
        http.patch(`${testInstance.url}/iamc/datapoints/`, () => HttpResponse.json({ upstream: 'private detail' }, { status: 503 }))
      );

      const res = await api.request(`/api/scenario-details/Broken?instance=${testInstance.slug}`, {}, await createTestEnv());

      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'Scenario source unavailable' });
      expect(errorLog).toHaveBeenCalledWith('Scenario source unavailable', {
        instance: testInstance.slug,
        errorType: 'Error',
      });
    } finally {
      errorLog.mockRestore();
    }
  });

  test('uses the selected instance when the same scenario exists in two sources', async () => {
    const second: Ixmp4Instance = {
      slug: 'detail-source',
      name: 'Detail source',
      url: 'https://detail.example/v1/detail-source',
      managerUrl: 'https://detail.example/v1',
    };
    instances.push(second);
    let firstRequests = 0;
    server.use(
      http.patch(`${testInstance.url}/runs/`, () => {
        firstRequests++;
        return HttpResponse.json(listEnvelope([]));
      }),
      http.patch(`${second.url}/runs/`, () => HttpResponse.json(listEnvelope([{ id: 1, model: { name: 'M' }, scenario: { name: 'Shared' }, version: 1, is_default: true }]))),
      http.patch(`${second.url}/iamc/datapoints/`, async ({ request }) => {
        const body = (await request.json()) as { variable?: { name?: string } };
        if (!body.variable) {
          return HttpResponse.json(tabulateEnvelope(['model', 'scenario', '2020', '2100'], [['M', 'Shared', 1, 2]]));
        }
        const median = body.variable.name?.endsWith('50th Percentile') ? 2.4 : 2.6;
        return HttpResponse.json(tabulateEnvelope(['model', 'scenario', 'unit', '2100'], [['FaIR', 'Shared', '°C', median]]));
      }),
      ...emptyIxmp4Handlers(second)
    );

    const res = await api.request(`/api/scenario-details/Shared?instance=${second.slug}`, {}, await createTestEnv());
    const json = (await res.json()) as ScenarioDetailsResponse;

    expect(res.status).toBe(200);
    expect(json.instance).toBe(second.slug);
    expect(json.gmt?.data[0][1]).toBe(2.4);
    expect(firstRequests).toBe(0);
  });
});
