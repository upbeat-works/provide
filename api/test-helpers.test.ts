import { describe, test, expect, afterEach, spyOn } from 'bun:test';
import { instances } from './instances';
import { mockIxmp4Fetch } from './test-helpers';

const instance = instances[0];

let spy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined;

afterEach(() => {
  spy?.mockRestore();
  spy = undefined;
});

async function patchJson(url: string, body: unknown = {}) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake' },
    body: JSON.stringify(body),
  });
  return res.json();
}

describe('mockIxmp4Fetch', () => {
  test('responds to POST /token/obtain/ with a fake access token', async () => {
    spy = mockIxmp4Fetch({});
    const res = await fetch(`${instance.managerUrl}/token/obtain/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'u', password: 'p' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ access: 'fake-token' });
  });

  test('returns fixture rows for PATCH /iamc/variables/', async () => {
    spy = mockIxmp4Fetch({
      variables: [{ id: 1, name: 'Temperature|Global Mean' }],
    });
    const data = await patchJson(`${instance.url}/iamc/variables/`);
    expect(data).toEqual({
      results: [{ id: 1, name: 'Temperature|Global Mean' }],
      total: 1,
    });
  });

  test('returns fixture rows for PATCH /scenarios/', async () => {
    spy = mockIxmp4Fetch({
      scenarios: [{ id: 7, name: 'curpol' }],
    });
    const data = await patchJson(`${instance.url}/scenarios/`);
    expect(data).toEqual({ results: [{ id: 7, name: 'curpol' }], total: 1 });
  });

  test('returns fixture rows for PATCH /regions/', async () => {
    spy = mockIxmp4Fetch({
      regions: [{ id: 2, name: 'DEU', hierarchy: 'admin0' }],
    });
    const data = await patchJson(`${instance.url}/regions/`);
    expect(data).toEqual({
      results: [{ id: 2, name: 'DEU', hierarchy: 'admin0' }],
      total: 1,
    });
  });

  test('returns fixture rows for PATCH /runs/', async () => {
    spy = mockIxmp4Fetch({
      runs: [
        {
          id: 11,
          model: { name: 'AIM' },
          scenario: { name: 'curpol' },
          version: 1,
          is_default: true,
        },
      ],
    });
    const data = await patchJson(`${instance.url}/runs/`);
    expect(data).toEqual({
      results: [
        {
          id: 11,
          model: { name: 'AIM' },
          scenario: { name: 'curpol' },
          version: 1,
          is_default: true,
        },
      ],
      total: 1,
    });
  });

  test('returns fixture rows for PATCH /meta/', async () => {
    spy = mockIxmp4Fetch({
      runMeta: [{ id: 1, run__id: 11, key: 'sector', type: 'STR', value: 'terclim' }],
    });
    const data = await patchJson(`${instance.url}/meta/`);
    expect(data).toEqual({
      results: [{ id: 1, run__id: 11, key: 'sector', type: 'STR', value: 'terclim' }],
      total: 1,
    });
  });

  test('returns fixture rows for PATCH /iamc/timeseries/', async () => {
    spy = mockIxmp4Fetch({
      timeseries: [{ id: 31, run__id: 11, parameters: { region: 'DEU', variable: 'X' } }],
    });
    const data = await patchJson(`${instance.url}/iamc/timeseries/`);
    expect(data).toEqual({
      results: [{ id: 31, run__id: 11, parameters: { region: 'DEU', variable: 'X' } }],
      total: 1,
    });
  });

  test('returns fixture rows for PATCH /iamc/datapoints/', async () => {
    spy = mockIxmp4Fetch({
      datapoints: [{ id: 41, time_series__id: 31, value: 1.5, type: 'ANNUAL', step_year: 2030 }],
    });
    const data = await patchJson(`${instance.url}/iamc/datapoints/`);
    expect(data).toEqual({
      results: [{ id: 41, time_series__id: 31, value: 1.5, type: 'ANNUAL', step_year: 2030 }],
      total: 1,
    });
  });

  test('defaults empty results when a path has no fixture entry', async () => {
    spy = mockIxmp4Fetch({});
    const data = await patchJson(`${instance.url}/iamc/variables/`);
    expect(data).toEqual({ results: [], total: 0 });
  });

  test('throws on unknown paths so missing fixtures fail loudly', async () => {
    spy = mockIxmp4Fetch({});
    await expect(fetch(`${instance.url}/nonsense/`, { method: 'PATCH' })).rejects.toThrow();
  });
});
