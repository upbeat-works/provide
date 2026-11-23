import { describe, test, expect, spyOn } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { sql } from 'drizzle-orm';
import { buildIndicatorsSeedSql, parseIndicatorsYaml } from '../db/import/import-indicators';
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
  test('sector and project totals count the same entries, including shared names', async () => {
    await useInstances([instance, secondInstance], async () => {
      const env = await createTestEnv();
      await env.DB.execute(sql.raw(buildIndicatorsSeedSql(parseIndicatorsYaml(`- id: Heat
  sector: urban-climate
- id: Cold
  sector: terrestrial-climate
`))));
      for (const [source, ids] of [[instance, ['Heat', 'Cold']], [secondInstance, ['Heat']]] as const) {
        server.use(
          http.patch(`${source.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope(ids.map((id, index) => variable(index + 1, id))))),
          http.patch(`${source.url}/runs/`, () => HttpResponse.json(listEnvelope([{ id: 1, model: { name: 'M' }, scenario: { name: 'S' }, version: 1, is_default: true }]))),
        );
        useUnit(source, 'days');
      }

      const filterCases: Array<Record<string, string>> = [
        { Project: 'PROVIDE,SPARCCLE' },
        { Project: 'PROVIDE' },
        { Sector: 'Urban Climate' },
      ];
      for (const filters of filterCases) {
        const res = await api.request(`/api/indicators?${new URLSearchParams(filters)}`, {}, env);
        const json = await res.json() as IndicatorIndexResponse & { filters: IndicatorFilterGroup[] };
        expect(res.status).toBe(200);
        expect(json.failedInstances).toEqual([]);
        const expected = [
          { id: 'Heat', instance: instance.slug, project: 'PROVIDE', sector: 'Urban Climate' },
          { id: 'Cold', instance: instance.slug, project: 'PROVIDE', sector: 'Terrestrial Climate' },
          { id: 'Heat', instance: secondInstance.slug, project: 'SPARCCLE', sector: 'Urban Climate' },
        ].filter((entry) => (!filters.Project || filters.Project.split(',').includes(entry.project)) && (!filters.Sector || entry.sector === filters.Sector));
        expect(json.indicators.map(({ id, instance }) => ({ id, instance }))).toEqual(expected.map(({ id, instance }) => ({ id, instance })));
        for (const key of ['Sector', 'Project']) {
          if (key in filters) continue;
          const total = json.filters.find((group) => group.key === key)!.options.reduce((sum, option) => sum + option.count, 0);
          expect(total).toBe(json.indicators.length);
        }
      }
    });
  });

  test('includes SPARCCLE Internal indicators using the shared login', async () => {
    const logins: unknown[] = [];
    let authorization: string | null = null;
    server.use(
      http.post(`${instance.managerUrl}/token/obtain/`, async ({ request }) => {
        logins.push(await request.json());
        return HttpResponse.json({ access: 'shared-access-token' });
      }),
      http.patch('https://ixmp4.ece.iiasa.ac.at/v1/sparccle-internal/iamc/variables/', ({ request }) => {
        authorization = request.headers.get('authorization');
        return HttpResponse.json(listEnvelope([variable(1, 'Heat')]));
      }),
      http.patch('https://ixmp4.ece.iiasa.ac.at/v1/sparccle-internal/units/', () =>
        HttpResponse.json(listEnvelope([{ id: 1, name: 'days' }]))
      )
    );

    const res = await api.request('/api/indicators', {}, await createTestEnv());
    const json = (await res.json()) as IndicatorIndexResponse;

    expect(res.status).toBe(200);
    expect(json.indicators).toContainEqual(expect.objectContaining({
      id: 'Heat',
      instance: 'sparccle-internal',
      unit: 'days',
    }));
    expect(json.failedInstances).toEqual([]);
    expect(authorization).toBe('Bearer shared-access-token');
    expect(logins.length).toBeGreaterThan(0);
    for (const login of logins) {
      expect(login).toEqual({ username: 'test-user', password: 'test-pass' });
    }
  });

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

  test('returns the plain index without loading runs or metadata when a facet is blank', async () => {
    const facetRequests: string[] = [];
    server.use(
      http.patch(`${instance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([variable(1, 'Heat')]))),
      http.patch(`${instance.url}/runs/`, () => {
        facetRequests.push('runs');
        return HttpResponse.json(listEnvelope([]));
      }),
      http.patch(`${instance.url}/meta/`, () => {
        facetRequests.push('meta');
        return HttpResponse.json(tabulateEnvelope(['run__id', 'key', 'value'], []));
      })
    );
    useUnit(instance, 'days');

    const res = await api.request('/api/indicators?Sector=', {}, await createTestEnv());

    expect(res.status).toBe(200);
    expect(facetRequests).toEqual([]);
    expect(await res.json()).toEqual({
      indicators: [{ id: 'Heat', label: 'Heat', unit: 'days', instance: instance.slug }],
      failedInstances: [],
    });
  });

  test('drops a malformed faceted variable with an empty indicator ID', async () => {
    server.use(http.patch(`${instance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([{ id: 1, name: '|2011-2020 (Present Day)|Annual|Area|50th Percentile' }, variable(2, 'Heat')]))));
    useUnit(instance, 'days');

    const res = await api.request('/api/indicators', {}, await createTestEnv());
    const json = (await res.json()) as IndicatorIndexResponse;

    expect(res.status).toBe(200);
    expect(json.indicators.map(({ id }) => id)).toEqual(['Heat']);
  });

  test('excludes unrelated five-part IAM names from the catalog', async () => {
    server.use(http.patch(`${instance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([
      { id: 1, name: 'Land Cover|Cropland|Energy Crops|Irrigated|Other' },
      variable(2, 'Heat'),
    ]))));
    useUnit(instance, 'days');

    const res = await api.request('/api/indicators', {}, await createTestEnv());
    const json = (await res.json()) as IndicatorIndexResponse;

    expect(res.status).toBe(200);
    expect(json.indicators.map(({ id }) => id)).toEqual(['Heat']);
    expect(json.failedInstances).toEqual([]);
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

  test('loads filter options without units, citations, or per-run variable lists', async () => {
    useFacetHandlers();
    const variableFilters: unknown[] = [];
    const metaFilters: unknown[] = [];
    let unitRequests = 0;
    server.use(
      http.patch(`${instance.url}/iamc/variables/`, async ({ request }) => {
        variableFilters.push(await request.json().catch(() => ({})));
        return HttpResponse.json(listEnvelope([variable(1, 'Heat'), variable(2, 'Glacier area')]));
      }),
      http.patch(`${instance.url}/units/`, () => {
        unitRequests++;
        return HttpResponse.json(listEnvelope([{ id: 1, name: 'days' }]));
      }),
      http.patch(`${instance.url}/meta/`, async ({ request }) => {
        metaFilters.push(await request.json());
        return HttpResponse.json(tabulateEnvelope(['run__id', 'key', 'value'], [[1, 'Temporal Resolution', 'Annual']]));
      }),
    );
    const res = await api.request('/api/indicators/filters', {}, await createTestEnv());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.filters.find(({ key }) => key === 'Temporal Resolution').options).toEqual([{ value: 'Annual', count: 1 }]);
    expect(json).not.toHaveProperty('indicators');
    expect(variableFilters).toEqual([{}]);
    expect(unitRequests).toBe(0);
    expect(metaFilters).toEqual([{ key__in: ['Data Source', 'Spatial Resolution', 'Temporal Resolution'] }]);
  });

  test('applies other selected groups to each cascading option count', async () => {
    useFacetHandlers();

    const query = new URLSearchParams({ Sector: '', 'Temporal Resolution': '5 years' });
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
        indexFilter = value as Record<string, unknown>;
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
    useFacetHandlers(() => HttpResponse.json(listEnvelope([variable(1, 'Heat')])));
    server.use(http.patch(`${instance.url}/runs/`, async ({ request }) => {
      const filter = await request.json() as { iamc?: { region?: { name?: string } } };
      runFilters.push(filter);
      const runs = [{ id: 1, model: { name: 'M' }, scenario: { name: 'a' }, version: 1, is_default: true }];
      if (filter.iamc?.region?.name !== 'DEU') runs.push({ id: 2, model: { name: 'M' }, scenario: { name: 'b' }, version: 1, is_default: true });
      return HttpResponse.json(listEnvelope(runs));
    }));

    const query = new URLSearchParams({
      region: 'DEU',
      'Temporal Resolution': '5 years',
    });
    const res = await api.request(`/api/indicators?${query}`, {}, await createTestEnv());
    const json = (await res.json()) as IndicatorIndexResponse & { filters: IndicatorFilterGroup[] };

    expect(res.status).toBe(200);
    expect(json.indicators).toEqual([]);
    expect(runFilters).toHaveLength(1);
    expect(runFilters[0]).toMatchObject({ iamc: { region: { name: 'DEU' } } });
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
  variablesHandler: Parameters<typeof http.patch>[1] = () => HttpResponse.json(listEnvelope([variable(1, 'Heat'), variable(2, 'Glacier area')]))
) {
  server.use(
    http.patch(`${instance.url}/runs/`, async ({ request }) => {
      const filter = await request.json() as { iamc?: { variable?: { name__in?: string[] } } };
      const names = filter.iamc?.variable?.name__in;
      const rows = [
        { id: 1, model: { name: 'M' }, scenario: { name: 'a' }, version: 1, is_default: true },
        { id: 2, model: { name: 'M' }, scenario: { name: 'b' }, version: 1, is_default: true },
      ].filter((run) => !names || names.some((name) => name.startsWith(run.id === 1 ? 'Heat|' : 'Glacier area|')));
      return HttpResponse.json(listEnvelope(rows));
    }),
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
