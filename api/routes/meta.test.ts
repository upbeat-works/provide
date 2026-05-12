import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { api } from '../index';
import { instances } from '../instances';
import { schema } from '../db';
import { createTestEnv } from '../test-helpers';
import type { Env } from '../types';

const instance = instances[0];
let env: Env['Bindings'];
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;

beforeEach(() => {
  env = createTestEnv();
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const req = new Request(input as RequestInfo, init);
    const url = new URL(req.url);

    if (req.method === 'POST' && url.href === `${instance.managerUrl}/token/obtain/`) {
      return new Response(JSON.stringify({ access: 'fake-token' }), { status: 200 });
    }
    if (req.method === 'PATCH' && url.href === `${instance.url}/iamc/variables/`) {
      return new Response(JSON.stringify({
        results: [{ id: 1, name: 'Temperature|Global Mean' }],
        total: 1,
      }), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${req.method} ${req.url}`);
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('GET /api/meta', () => {
  test('returns the full merged metadata shape', async () => {
    const res = await api.request('/api/meta', {}, env);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty('geographyTypes');
    expect(json).toHaveProperty('geographies');
    expect(json).toHaveProperty('indicators');
    expect(json).toHaveProperty('scenarios');
    expect(json).toHaveProperty('sectors');
    expect(json).toHaveProperty('units');
  });

  test('indicators are tagged with their source instance slug', async () => {
    const res = await api.request('/api/meta', {}, env);
    const json = await res.json() as { indicators: Array<{ id: string; instance: string }> };
    expect(json.indicators).toEqual([{ id: 'Temperature|Global Mean', instance: instance.slug }]);
  });

  test('geographies come from the local DB', async () => {
    await env.DB.insert(schema.geographyTypes).values({ id: 'admin0', label: 'Countries' });
    await env.DB.insert(schema.geographies).values({ id: 'FRA', label: 'France', geographyType: 'admin0' });

    const res = await api.request('/api/meta', {}, env);
    const json = await res.json() as { geographies: Array<{ id: string }> };
    expect(json.geographies.map((g) => g.id)).toEqual(['FRA']);
  });
});
