import { describe, test, expect, afterEach, spyOn } from 'bun:test';
import { api } from '../index';
import { schema } from '../db';
import { createTestEnv, mockIxmp4Fetch } from '../test-helpers';
import type { Env } from '../types';

let spy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined;

afterEach(() => {
  spy?.mockRestore();
  spy = undefined;
});

async function seed(env: Env['Bindings']) {
  await env.DB.insert(schema.geographyTypes).values([
    { id: 'admin0', label: 'Countries', labelSingular: 'Country', order: 1, isAvailable: true },
    { id: 'cities', label: 'Cities', labelSingular: 'City', order: 2, isAvailable: true },
  ]);
  await env.DB.insert(schema.geographies).values([
    { id: 'DEU', label: 'Germany', geographyType: 'admin0' },
    { id: 'FRA', label: 'France', geographyType: 'admin0' },
    { id: 'berlin', label: 'Berlin', geographyType: 'cities' },
  ]);
}

function fixture() {
  return mockIxmp4Fetch({
    variables: [{ id: 1, name: 'terclim-mean-temperature' }],
    runs: [
      { id: 1, model: { name: 'M' }, scenario: { name: 'curpol' }, version: 1, is_default: true },
    ],
  });
}

describe('GET /api/meta', () => {
  test('returns the legacy top-level keys', async () => {
    const env = createTestEnv();
    await seed(env);
    spy = fixture();
    const res = await api.request('/api/meta', {}, env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    for (const key of [
      'geographyTypes',
      'admin0',
      'cities',
      'scenarios',
      'sectors',
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
    spy = fixture();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as {
      admin0: Array<{ uid: string; label: string }>;
      cities: Array<{ uid: string; label: string }>;
    };
    expect(json.admin0.map((g) => g.uid).sort()).toEqual(['DEU', 'FRA']);
    expect(json.cities.map((g) => g.uid)).toEqual(['berlin']);
  });

  test('enriches indicators with curation metadata', async () => {
    const env = createTestEnv();
    await seed(env);
    spy = fixture();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as {
      indicators: Array<{ uid: string; label: string; sector: string; unit: string }>;
    };
    const ind = json.indicators.find((i) => i.uid === 'terclim-mean-temperature');
    expect(ind).toMatchObject({
      label: 'Mean Temperature',
      sector: 'terrestrial-climate',
      unit: 'degrees-celsius',
    });
  });

  test('embeds curated gmt and emissions trajectories in scenarios', async () => {
    const env = createTestEnv();
    await seed(env);
    spy = fixture();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as {
      scenarios: Array<{
        uid: string;
        gmt: { yearStart: number; yearStep: number; data: number[][] };
        emissions: { yearStart: number; yearStep: number; data: number[] | null };
      }>;
    };
    const curpol = json.scenarios.find((s) => s.uid === 'curpol')!;
    expect(curpol.gmt.yearStart).toBe(2020);
    expect(curpol.gmt.yearStep).toBe(5);
    expect(curpol.gmt.data[0]).toEqual([1.51278, 1.3146, 1.121]);
    expect(curpol.emissions.yearStart).toBe(2020);
  });

  test('returns sectors, studyLocations, likelihoods, indicatorParameters as arrays', async () => {
    const env = createTestEnv();
    await seed(env);
    spy = fixture();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as Record<string, unknown[]>;
    for (const key of ['sectors', 'studyLocations', 'likelihoods', 'indicatorParameters']) {
      expect(Array.isArray(json[key])).toBe(true);
      expect((json[key] as unknown[]).length).toBeGreaterThan(0);
    }
  });

  test('returns geographyTypes in the curated uid-keyed shape', async () => {
    const env = createTestEnv();
    await seed(env);
    spy = fixture();
    const res = await api.request('/api/meta', {}, env);
    const json = (await res.json()) as {
      geographyTypes: Array<{ uid: string; icon: string; availableIndicators: string[] }>;
    };
    const admin0 = json.geographyTypes.find((t) => t.uid === 'admin0');
    expect(admin0?.icon).toBe('🗺️');
    expect(Array.isArray(admin0?.availableIndicators)).toBe(true);
  });
});
