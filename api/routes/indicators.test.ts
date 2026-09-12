import { describe, test, expect, spyOn } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { api } from '../index';
import { instances } from '../instances';
import { schema } from '../db';
import type { IndicatorFilterGroup, IndicatorIndexResponse } from '../catalog/contracts';
import type { Ixmp4Instance } from '../types';
import { createTestEnv, emptyIxmp4Handlers, listEnvelope, server, tabulateEnvelope } from '../test-helpers';

const instance = instances[0];
const secondInstance: Ixmp4Instance = {
  slug: 'sparccle',
  name: 'SPARCCLE',
  url: 'https://ixmp4.example.test/v1/sparccle',
  managerUrl: 'https://manager.example.test/v1',
  project: 'SPARCCLE',
};

function useInstances<T>(configured: Ixmp4Instance[], run: () => Promise<T>): Promise<T> {
  const original = [...instances];
  instances.splice(0, instances.length, ...configured);
  server.use(...configured.slice(1).flatMap(emptyIxmp4Handlers));
  return run().finally(() => instances.splice(0, instances.length, ...original));
}

function variable(id: number, indicator: string) {
  return {
    id,
    name: `${indicator}|2011-2020 (Present Day)|Annual|Area|50th Percentile`,
  };
}

function useUnit(instanceUnderTest: Ixmp4Instance, unit: string) {
  server.use(http.patch(`${instanceUnderTest.url}/units/`, () => HttpResponse.json(listEnvelope([{ id: 1, name: unit }]))));
}

describe('GET /api/indicators', () => {
  test('returns the full indicator index contract with curated sector data', async () => {
    let unitFilter: unknown;
    server.use(
      http.patch(`${instance.url}/iamc/variables/`, () =>
        HttpResponse.json(
          listEnvelope([
            variable(1, 'Heat'),
            { id: 2, name: 'Heat|2011-2020 (Present Day)|Annual|Area|1.5 °C' },
            { id: 4, name: 'Global Mean Temperature|50th Percentile' },
            { id: 5, name: 'Emissions|CO2' },
          ])
        )
      ),
      http.patch(`${instance.url}/units/`, async ({ request }) => {
        unitFilter = await request.json();
        return HttpResponse.json(listEnvelope([{ id: 1, name: 'days' }]));
      })
    );
    const env = await createTestEnv();
    await env.DB.insert(schema.indicators).values({ id: 'Heat', sector: 'health' });

    const res = await api.request('/api/indicators', {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      indicators: [
        {
          id: 'Heat',
          label: 'Heat',
          unit: 'days',
          sector: 'health',
          instance: instance.slug,
        },
      ],
      failedInstances: [],
    });
    expect(unitFilter).toEqual({
      iamc: { variable: { name__in: [variable(1, 'Heat').name] } },
    });
  });

  test('returns unselected filter groups when a known facet key is blank', async () => {
    useFacetHandlers();
    const env = await createTestEnv();
    await env.DB.insert(schema.indicators).values([
      { id: 'Heat', sector: 'health' },
      { id: 'Glacier area', sector: 'cryosphere' },
    ]);

    const res = await api.request('/api/indicators?Sector=', {}, env);
    const json = (await res.json()) as IndicatorIndexResponse & { filters: IndicatorFilterGroup[] };

    expect(res.status).toBe(200);
    expect(json.filters.every(({ selected }) => selected.length === 0)).toBe(true);
    expect(json.filters.find(({ key }) => key === 'Sector')?.options).toEqual([
      { value: 'Cryosphere', count: 1 },
      { value: 'Health', count: 1 },
    ]);
  });

  test('drops a malformed faceted variable with an empty indicator ID', async () => {
    server.use(http.patch(`${instance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([{ id: 1, name: '|2011-2020 (Present Day)|Annual|Area|50th Percentile' }, variable(2, 'Heat')]))));
    useUnit(instance, 'days');

    const res = await api.request('/api/indicators', {}, await createTestEnv());
    const json = (await res.json()) as IndicatorIndexResponse;

    expect(res.status).toBe(200);
    expect(json.indicators.map(({ id }) => id)).toEqual(['Heat']);
  });

  test('keeps equal indicator IDs from different instances as separate entries', async () => {
    await useInstances([instance, secondInstance], async () => {
      server.use(
        http.patch(`${instance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([variable(1, 'Heat')]))),
        http.patch(`${secondInstance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([variable(2, 'Heat')])))
      );
      useUnit(instance, 'days');
      useUnit(secondInstance, 'days');

      const res = await api.request('/api/indicators', {}, await createTestEnv());
      const json = (await res.json()) as IndicatorIndexResponse;

      expect(res.status).toBe(200);
      expect(json.indicators.map(({ id, instance }) => ({ id, instance }))).toEqual([
        { id: 'Heat', instance: 'provide-internal' },
        { id: 'Heat', instance: 'sparccle' },
      ]);
      expect(json.failedInstances).toEqual([]);
    });
  });

  test('returns working data when another instance fails during authentication', async () => {
    const errorLog = spyOn(console, 'error').mockImplementation(() => {});
    try {
      await useInstances([instance, secondInstance], async () => {
        let failedVariableRequests = 0;
        server.use(
          http.post(`${secondInstance.managerUrl}/token/obtain/`, () => HttpResponse.json({ error: 'offline' }, { status: 503 })),
          http.patch(`${instance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([variable(1, 'Heat')]))),
          http.patch(`${secondInstance.url}/iamc/variables/`, () => {
            failedVariableRequests++;
            return HttpResponse.json(listEnvelope([variable(2, 'Cold')]));
          })
        );
        useUnit(instance, 'days');

        const res = await api.request('/api/indicators', {}, await createTestEnv());

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          indicators: [{ id: 'Heat', label: 'Heat', unit: 'days', instance: 'provide-internal' }],
          failedInstances: [{ instance: 'sparccle', code: 'unavailable' }],
        });
        expect(failedVariableRequests).toBe(0);
        expect(errorLog).toHaveBeenCalledWith('Indicator source unavailable', {
          instance: 'sparccle',
          errorType: 'Error',
        });
      });
    } finally {
      errorLog.mockRestore();
    }
  });

  test('returns 503 without source details when every instance fails', async () => {
    const errorLog = spyOn(console, 'error').mockImplementation(() => {});
    try {
      await useInstances([instance, secondInstance], async () => {
        server.use(
          http.post(`${instance.managerUrl}/token/obtain/`, () => HttpResponse.json({ error: 'offline' }, { status: 503 })),
          http.post(`${secondInstance.managerUrl}/token/obtain/`, () => HttpResponse.json({ error: 'offline' }, { status: 503 }))
        );

        const res = await api.request('/api/indicators', {}, await createTestEnv());

        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ error: 'Indicator sources unavailable' });
      });
    } finally {
      errorLog.mockRestore();
    }
  });

  test('applies other selected groups to each cascading option count', async () => {
    useFacetHandlers();

    const query = new URLSearchParams({ 'Temporal Resolution': '5 years' });
    const res = await api.request(`/api/indicators?${query}`, {}, await createTestEnv());
    const json = (await res.json()) as IndicatorIndexResponse & { filters: IndicatorFilterGroup[] };

    expect(json.indicators.map(({ id }) => id)).toEqual(['Glacier area']);
    expect(json.filters.find(({ key }) => key === 'Temporal Resolution')).toEqual({
      key: 'Temporal Resolution',
      label: 'TEMPORAL',
      color: 'sky',
      options: [
        { value: '5 years', count: 1 },
        { value: 'Annual', count: 1 },
      ],
      selected: ['5 years'],
    });
    expect(json.filters.find(({ key }) => key === 'Spatial Resolution')?.options).toEqual([
      { value: 'Global', count: 0 },
      { value: 'National', count: 1 },
    ]);
  });

  test('treats comma-separated values in one group as alternatives', async () => {
    useFacetHandlers();

    const query = new URLSearchParams({ 'Temporal Resolution': 'Annual,5 years' });
    const res = await api.request(`/api/indicators?${query}`, {}, await createTestEnv());
    const json = (await res.json()) as IndicatorIndexResponse & { filters: IndicatorFilterGroup[] };

    expect(json.indicators.map(({ id }) => id)).toEqual(['Heat', 'Glacier area']);
    expect(json.filters.find(({ key }) => key === 'Temporal Resolution')?.selected).toEqual(['Annual', '5 years']);
  });

  test('combines region availability with advanced filters', async () => {
    let indexFilter: Record<string, unknown> | undefined;
    useFacetHandlers(({ request }) => {
      const body = request.json().catch(() => ({}));
      return body.then((value) => {
        const filter = value as { run?: { id__in?: number[] }; region?: unknown };
        const runId = filter.run?.id__in?.[0];
        if (runId === 1) return HttpResponse.json(listEnvelope([variable(1, 'Heat')]));
        if (runId === 2) return HttpResponse.json(listEnvelope([variable(2, 'Glacier area')]));
        indexFilter = filter;
        return HttpResponse.json(listEnvelope([variable(2, 'Glacier area')]));
      });
    });

    const query = new URLSearchParams({
      region: 'DEU',
      'Temporal Resolution': '5 years',
    });
    const res = await api.request(`/api/indicators?${query}`, {}, await createTestEnv());
    const json = (await res.json()) as IndicatorIndexResponse & { filters: IndicatorFilterGroup[] };

    expect(res.status).toBe(200);
    expect(indexFilter).toEqual({ region: { name: 'DEU' } });
    expect(json.indicators.map(({ id }) => id)).toEqual(['Glacier area']);
    expect(json.filters.find(({ key }) => key === 'Spatial Resolution')?.options).toEqual([
      { value: 'Global', count: 0 },
      { value: 'National', count: 1 },
    ]);
  });

  test('applies region availability to each run before a run facet', async () => {
    const runFilters: Array<Record<string, unknown>> = [];
    useFacetHandlers(async ({ request }) => {
      const filter = (await request.json().catch(() => ({}))) as {
        run?: { id__in?: number[] };
        region?: { name?: string };
      };
      const runId = filter.run?.id__in?.[0];
      if (!runId) return HttpResponse.json(listEnvelope([variable(1, 'Heat')]));

      runFilters.push(filter);
      if (runId === 1) return HttpResponse.json(listEnvelope([variable(1, 'Heat')]));
      if (filter.region?.name !== 'DEU') return HttpResponse.json(listEnvelope([variable(2, 'Heat')]));
      return HttpResponse.json(listEnvelope([]));
    });

    const query = new URLSearchParams({
      region: 'DEU',
      'Temporal Resolution': '5 years',
    });
    const res = await api.request(`/api/indicators?${query}`, {}, await createTestEnv());
    const json = (await res.json()) as IndicatorIndexResponse & { filters: IndicatorFilterGroup[] };

    expect(res.status).toBe(200);
    expect(json.indicators).toEqual([]);
    expect(runFilters).toHaveLength(2);
    expect(runFilters.every((filter) => filter.region && (filter.region as { name?: string }).name === 'DEU')).toBe(true);
  });

  test('does not send q to IXMP4', async () => {
    let captured: unknown = { missing: true };
    server.use(
      http.patch(`${instance.url}/iamc/variables/`, async ({ request }) => {
        captured = await request.json().catch(() => ({}));
        return HttpResponse.json(listEnvelope([variable(1, 'Heat'), variable(2, 'Cold')]));
      })
    );
    useUnit(instance, 'days');

    const res = await api.request('/api/indicators?q=heat', {}, await createTestEnv());
    const json = (await res.json()) as IndicatorIndexResponse;

    expect(captured).toEqual({});
    expect(json.indicators.map(({ id }) => id)).toEqual(['Heat', 'Cold']);
  });
});

function useFacetHandlers(
  variablesHandler: Parameters<typeof http.patch>[1] = async ({ request }) => {
    const filter = (await request.json().catch(() => ({}))) as { run?: { id__in?: number[] } };
    const runId = filter.run?.id__in?.[0];
    if (runId === 1) return HttpResponse.json(listEnvelope([variable(1, 'Heat')]));
    if (runId === 2) return HttpResponse.json(listEnvelope([variable(2, 'Glacier area')]));
    return HttpResponse.json(listEnvelope([variable(1, 'Heat'), variable(2, 'Glacier area')]));
  }
) {
  server.use(
    http.patch(`${instance.url}/runs/`, () =>
      HttpResponse.json(
        listEnvelope([
          { id: 1, model: { name: 'M' }, scenario: { name: 'a' }, version: 1, is_default: true },
          { id: 2, model: { name: 'M' }, scenario: { name: 'b' }, version: 1, is_default: true },
        ])
      )
    ),
    http.patch(`${instance.url}/meta/`, () =>
      HttpResponse.json(
        tabulateEnvelope(
          ['run__id', 'key', 'value'],
          [
            [1, 'Temporal Resolution', 'Annual'],
            [1, 'Spatial Resolution', 'Global'],
            [2, 'Temporal Resolution', '5 years'],
            [2, 'Spatial Resolution', 'National'],
          ]
        )
      )
    ),
    http.patch(`${instance.url}/iamc/variables/`, variablesHandler)
  );
  useUnit(instance, 'days');
}
