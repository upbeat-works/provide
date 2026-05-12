import { describe, test, expect, afterEach, spyOn } from 'bun:test';
import { api } from '../index';
import { createTestEnv, mockIxmp4Fetch } from '../test-helpers';

let spy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined;

afterEach(() => {
  spy?.mockRestore();
  spy = undefined;
});

describe('GET /api/scenarios', () => {
  test('returns curated scenarios for runs that exist in ixmp4', async () => {
    spy = mockIxmp4Fetch({
      runs: [
        { id: 1, model: { name: 'M' }, scenario: { name: 'curpol' }, version: 1, is_default: true },
        { id: 2, model: { name: 'M' }, scenario: { name: 'gs' }, version: 1, is_default: true },
      ],
    });
    const res = await api.request('/api/scenarios', {}, createTestEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      scenarios: Array<{
        uid: string;
        label: string;
        source: { label: string };
        baseScenario: string;
        characteristics: Record<string, unknown>;
        warmingCategory: string;
        isPrimary: boolean;
      }>;
    };
    expect(json.scenarios).toHaveLength(2);
    const curpol = json.scenarios.find((s) => s.uid === 'curpol');
    expect(curpol).toMatchObject({
      uid: 'curpol',
      label: 'Current Policies',
      baseScenario: 'curpol',
      warmingCategory: 'high',
      isPrimary: true,
    });
    expect(curpol?.source).toEqual({ label: 'IPCC AR6' });
    expect(curpol?.characteristics).toMatchObject({ gmt2100: 2.7 });
  });

  test('drops ixmp4 scenarios that have no curation entry (curated allow-list)', async () => {
    spy = mockIxmp4Fetch({
      runs: [
        { id: 1, model: { name: 'M' }, scenario: { name: 'curpol' }, version: 1, is_default: true },
        { id: 9, model: { name: 'M' }, scenario: { name: 'mystery' }, version: 1, is_default: true },
      ],
    });
    const res = await api.request('/api/scenarios', {}, createTestEnv());
    const json = (await res.json()) as { scenarios: Array<{ uid: string }> };
    expect(json.scenarios.map((s) => s.uid)).toEqual(['curpol']);
  });

  test('embeds curated gmt and emissions trajectories inline', async () => {
    spy = mockIxmp4Fetch({
      runs: [
        { id: 1, model: { name: 'M' }, scenario: { name: 'curpol' }, version: 1, is_default: true },
      ],
    });
    const res = await api.request('/api/scenarios', {}, createTestEnv());
    const json = (await res.json()) as {
      scenarios: Array<{
        uid: string;
        gmt: { yearStart: number; yearStep: number; data: number[][]; unit?: string };
        emissions: { yearStart: number; yearStep: number; data: number[] | null; unit?: string };
      }>;
    };
    const curpol = json.scenarios.find((s) => s.uid === 'curpol')!;
    expect(curpol.gmt.yearStart).toBe(2020);
    expect(curpol.gmt.yearStep).toBe(5);
    expect(curpol.gmt.data[0]).toEqual([1.51278, 1.3146, 1.121]);
    expect(curpol.emissions.yearStart).toBe(2020);
    expect(Array.isArray(curpol.emissions.data)).toBe(true);
  });

  test('returns an empty list when ixmp4 has no runs', async () => {
    spy = mockIxmp4Fetch({});
    const res = await api.request('/api/scenarios', {}, createTestEnv());
    const json = (await res.json()) as { scenarios: unknown[] };
    expect(json.scenarios).toEqual([]);
  });
});
