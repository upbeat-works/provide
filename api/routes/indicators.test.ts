import { describe, test, expect, afterEach, spyOn } from 'bun:test';
import { api } from '../index';
import { instances } from '../instances';
import { createTestEnv, mockIxmp4Fetch } from '../test-helpers';

const instance = instances[0];
let spy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined;

afterEach(() => {
  spy?.mockRestore();
  spy = undefined;
});

describe('GET /api/indicators', () => {
  test('returns curated indicators joined with ixmp4 variables', async () => {
    spy = mockIxmp4Fetch({
      variables: [
        { id: 1, name: 'terclim-mean-temperature' },
        { id: 2, name: 'terclim-hot-extreme' },
      ],
    });
    const res = await api.request('/api/indicators', {}, createTestEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      indicators: Array<{
        uid: string;
        label: string;
        unit: string;
        sector: string;
        direction: number;
        parameters: Record<string, string[]>;
        availableGeographies: string[];
        availableScenarios: string[];
        instance: string;
      }>;
    };
    expect(json.indicators).toHaveLength(2);
    const meanTemp = json.indicators.find((i) => i.uid === 'terclim-mean-temperature');
    expect(meanTemp).toMatchObject({
      uid: 'terclim-mean-temperature',
      label: 'Mean Temperature',
      unit: 'degrees-celsius',
      sector: 'terrestrial-climate',
      direction: -1,
      instance: instance.slug,
    });
    expect(meanTemp?.parameters.time).toEqual(['annual', 'djf', 'mam', 'jja', 'son']);
    expect(Array.isArray(meanTemp?.availableGeographies)).toBe(true);
    expect(Array.isArray(meanTemp?.availableScenarios)).toBe(true);
  });

  test('drops ixmp4 variables that have no curation entry', async () => {
    spy = mockIxmp4Fetch({
      variables: [
        { id: 1, name: 'terclim-mean-temperature' },
        { id: 9, name: 'made-up-thing' },
      ],
    });
    const res = await api.request('/api/indicators', {}, createTestEnv());
    const json = (await res.json()) as { indicators: Array<{ uid: string }> };
    expect(json.indicators.map((i) => i.uid)).toEqual(['terclim-mean-temperature']);
  });

  test('filters by ?sector=', async () => {
    spy = mockIxmp4Fetch({
      variables: [
        { id: 1, name: 'terclim-mean-temperature' },
        { id: 2, name: 'urbclim-T2M-dayover25' },
      ],
    });
    const res = await api.request('/api/indicators?sector=urban-climate', {}, createTestEnv());
    const json = (await res.json()) as { indicators: Array<{ uid: string; sector: string }> };
    for (const ind of json.indicators) {
      expect(ind.sector).toBe('urban-climate');
    }
    expect(json.indicators.map((i) => i.uid)).toContain('urbclim-T2M-dayover25');
    expect(json.indicators.map((i) => i.uid)).not.toContain('terclim-mean-temperature');
  });

  test('forwards ?q= as an ilike filter to ixmp4', async () => {
    let captured: unknown;
    spy = spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = new Request(input as RequestInfo, init);
      const url = new URL(req.url);
      if (req.method === 'POST' && url.pathname.endsWith('/token/obtain/')) {
        return new Response(JSON.stringify({ access: 'fake-token' }), { status: 200 });
      }
      if (req.method === 'PATCH' && url.pathname.endsWith('/iamc/variables/')) {
        captured = await req.json();
        return new Response(JSON.stringify({ results: [], total: 0 }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${req.method} ${req.url}`);
    });
    await api.request('/api/indicators?q=temperature', {}, createTestEnv());
    expect(captured).toEqual({ name__ilike: '*temperature*' });
  });

  test('sends no name filter when ?q is absent', async () => {
    let captured: unknown;
    spy = spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = new Request(input as RequestInfo, init);
      const url = new URL(req.url);
      if (req.method === 'POST' && url.pathname.endsWith('/token/obtain/')) {
        return new Response(JSON.stringify({ access: 'fake-token' }), { status: 200 });
      }
      if (req.method === 'PATCH' && url.pathname.endsWith('/iamc/variables/')) {
        captured = await req.json();
        return new Response(JSON.stringify({ results: [], total: 0 }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${req.method} ${req.url}`);
    });
    await api.request('/api/indicators', {}, createTestEnv());
    expect(captured).toEqual({});
  });
});
