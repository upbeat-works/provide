import { describe, test, expect } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { api } from '../index';
import { schema } from '../db';
import { createTestEnv, listEnvelope, server, testInstance } from '../test-helpers';
import type { Env } from '../types';

async function seed(env: Env['Bindings']) {
  await env.DB.insert(schema.geographyTypes).values([
    { id: 'admin0', label: 'Countries', labelSingular: 'Country', order: 1, isAvailable: true },
    { id: 'cities', label: 'Cities', labelSingular: 'City', order: 2, isAvailable: true },
  ]);
  await env.DB.insert(schema.geographies).values([
    { id: 'Germany', label: 'Germany', geographyType: 'admin0', geoId: 'DEU' },
    { id: 'France', label: 'France', geographyType: 'admin0', geoId: 'FRA' },
    { id: 'berlin', label: 'Berlin', geographyType: 'cities', geoId: 'berlin' },
  ]);
}

function useFixtureHandlers() {
  server.use(
    http.patch(`${testInstance.url}/iamc/variables/`, () =>
      HttpResponse.json(
        listEnvelope([
          { id: 1, name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile' },
          { id: 2, name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|1.5 °C' },
        ]),
      ),
    ),
    http.patch(`${testInstance.url}/runs/`, () =>
      HttpResponse.json(
        listEnvelope([
          { id: 1, model: { name: 'M' }, scenario: { name: 'curpol' }, version: 1, is_default: true },
        ]),
      ),
    ),
  );
}

describe('GET /api/meta', () => {
  test('returns the legacy top-level keys', async () => {
    const env = createTestEnv();
    await seed(env);
    useFixtureHandlers();
    const res = await api.request('/api/meta', {}, env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    for (const key of [
      'geographyTypes',
      'admin0',
      'cities',
      'scenarios',
      'indicators',
      'indicatorParameters',
      'studyLocations',
      'likelihoods',
    ]) {
      expect(json).toHaveProperty(key);
    }
  });

  test('exposes geographies as one top-level array per geography type', async () => {
    const env = createTestEnv();
    await seed(env);
    useFixtureHandlers();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as {
      admin0: Array<{ uid: string; label: string }>;
      cities: Array<{ uid: string; label: string }>;
    };
    expect(json.admin0.map((g) => g.uid).sort()).toEqual(['France', 'Germany']);
    expect(json.cities.map((g) => g.uid)).toEqual(['berlin']);
  });

  test('exposes each geography geoId for linking to map shapes', async () => {
    const env = createTestEnv();
    await seed(env);
    useFixtureHandlers();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as {
      admin0: Array<{ uid: string; geoId?: string }>;
    };
    expect(json.admin0.find((g) => g.uid === 'Germany')?.geoId).toBe('DEU');
  });

  test('collapses convention variables into one indicator with its facet values', async () => {
    const env = createTestEnv();
    await seed(env);
    useFixtureHandlers();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as {
      indicators: Array<{
        uid: string;
        label: string;
        temporals: string[];
        warmingLevels: string[];
        percentiles: string[];
      }>;
    };
    // The two raw variable strings collapse into a single searchable indicator.
    expect(json.indicators.map((i) => i.uid)).toEqual(['Mean Temperature']);
    const mt = json.indicators[0];
    expect(mt.label).toBe('Mean Temperature');
    expect(mt.temporals).toEqual(['Annual']);
    expect(mt.percentiles).toEqual(['50th Percentile']);
    expect(mt.warmingLevels).toEqual(['1.5 °C']);
  });

  test('exposes convention facets as selector parameters (time/reference/spatial)', async () => {
    const env = createTestEnv();
    await seed(env);
    useFixtureHandlers();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as {
      indicators: Array<{ uid: string; parameters: Record<string, string[]> }>;
      indicatorParameters: Array<{ uid: string; label: string; options: Array<{ uid: string; label: string }> }>;
    };
    const mt = json.indicators.find((i) => i.uid === 'Mean Temperature')!;
    expect(mt.parameters.time).toEqual(['Annual']);
    expect(mt.parameters.reference).toEqual(['2011-2020 (Present Day)']);
    expect(mt.parameters.spatial).toEqual(['Area']);
    // The global dictionary mirrors the facets with raw uid === label.
    const time = json.indicatorParameters.find((p) => p.uid === 'time')!;
    expect(time.options).toEqual([{ uid: 'Annual', label: 'Annual' }]);
  });

  test('derives scenarios from ixmp4 runs (name is the id, no curation)', async () => {
    const env = createTestEnv();
    await seed(env);
    useFixtureHandlers();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as { scenarios: Array<{ uid: string; label: string }> };
    // The runs fixture exposes one scenario, "curpol"; it surfaces verbatim.
    expect(json.scenarios).toEqual([{ uid: 'curpol', label: 'curpol' }]);
  });

  test('returns sectors, studyLocations, likelihoods, indicatorParameters as arrays', async () => {
    const env = createTestEnv();
    await seed(env);
    useFixtureHandlers();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as Record<string, unknown[]>;
    for (const key of ['studyLocations', 'likelihoods', 'indicatorParameters']) {
      expect(Array.isArray(json[key])).toBe(true);
      expect((json[key] as unknown[]).length).toBeGreaterThan(0);
    }
  });

  test('sources geographyTypes from D1', async () => {
    const env = createTestEnv();
    await seed(env);
    useFixtureHandlers();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as {
      geographyTypes: Array<{
        uid: string;
        label: string;
        labelSingular?: string;
        order?: number;
        isAvailable: boolean;
      }>;
    };
    expect(json.geographyTypes.map((t) => t.uid)).toEqual(['admin0', 'cities']);
    const admin0 = json.geographyTypes.find((t) => t.uid === 'admin0');
    expect(admin0).toMatchObject({
      uid: 'admin0',
      label: 'Countries',
      labelSingular: 'Country',
      order: 1,
      isAvailable: true,
    });
  });

  test('omits geographyTypes that have no rows in D1', async () => {
    const env = createTestEnv();
    useFixtureHandlers();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as { geographyTypes: unknown[] };
    expect(json.geographyTypes).toEqual([]);
  });

  test('includes a continent list', async () => {
    const env = createTestEnv();
    await seedHierarchy(env);
    useFixtureHandlers();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as Record<string, Array<{ uid: string }>>;
    expect(json.continent.map((c) => c.uid)).toEqual(['Africa']);
  });

  test('attaches parents to each geography', async () => {
    const env = createTestEnv();
    await seedHierarchy(env);
    useFixtureHandlers();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as Record<string, Array<{ uid: string; parents: string[] }>>;
    expect(json.admin0.find((g) => g.uid === 'Egypt')?.parents).toEqual(['Africa']);
    expect(json.cities.find((g) => g.uid === 'Cairo')?.parents).toEqual(['Egypt']);
  });

  test('marks the continent type as not selectable', async () => {
    const env = createTestEnv();
    await seedHierarchy(env);
    useFixtureHandlers();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as { geographyTypes: Array<{ uid: string; isSelectable: boolean }> };
    expect(json.geographyTypes.find((t) => t.uid === 'continent')?.isSelectable).toBe(false);
  });
});

async function seedHierarchy(env: Env['Bindings']) {
  await env.DB.insert(schema.geographyTypes).values([
    { id: 'continent', label: 'Continents', order: -1, isSelectable: false },
    { id: 'admin0', label: 'Countries', order: 0, isSelectable: true },
    { id: 'cities', label: 'Cities', order: 1, isSelectable: true },
  ]);
  await env.DB.insert(schema.geographies).values([
    { id: 'Africa', label: 'Africa', geographyType: 'continent' },
    { id: 'Egypt', label: 'Egypt', geographyType: 'admin0' },
    { id: 'Cairo', label: 'Cairo', geographyType: 'cities' },
  ]);
  await env.DB.insert(schema.geographyParents).values([
    { geographyId: 'Egypt', parentId: 'Africa' },
    { geographyId: 'Cairo', parentId: 'Egypt' },
  ]);
}
