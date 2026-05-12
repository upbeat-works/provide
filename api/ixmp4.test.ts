import { describe, test, expect, afterEach, spyOn } from 'bun:test';
import { fetchRuns, fetchRunMeta, fetchTimeSeries } from './ixmp4';
import { instances } from './instances';
import { mockIxmp4Fetch } from './test-helpers';

const instance = instances[0];
let spy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined;

afterEach(() => {
  spy?.mockRestore();
  spy = undefined;
});

describe('fetchRuns', () => {
  test('PATCHes /runs/ and returns the ixmp4 run rows as-is (snake_case)', async () => {
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
    const runs = await fetchRuns(instance.url, instance.managerUrl, 'u', 'p');
    expect(runs).toEqual([
      {
        id: 11,
        model: { name: 'AIM' },
        scenario: { name: 'curpol' },
        version: 1,
        is_default: true,
      },
    ]);
  });
});

describe('fetchRunMeta', () => {
  test('PATCHes /meta/ scoped by run_id and returns the meta rows', async () => {
    spy = mockIxmp4Fetch({
      runMeta: [
        { id: 1, run__id: 11, key: 'sector', type: 'STR', value: 'terclim' },
        { id: 2, run__id: 11, key: 'isPrimary', type: 'BOOL', value: true },
      ],
    });
    const meta = await fetchRunMeta(instance.url, instance.managerUrl, 'u', 'p', 11);
    expect(meta).toEqual([
      { id: 1, run__id: 11, key: 'sector', type: 'STR', value: 'terclim' },
      { id: 2, run__id: 11, key: 'isPrimary', type: 'BOOL', value: true },
    ]);
  });

  test('sends {run_id} as the ixmp4 filter body', async () => {
    let captured: unknown;
    spy = spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = new Request(input as RequestInfo, init);
      const url = new URL(req.url);
      if (req.method === 'POST' && url.pathname.endsWith('/token/obtain/')) {
        return new Response(JSON.stringify({ access: 'fake-token' }), { status: 200 });
      }
      if (req.method === 'PATCH' && url.pathname.endsWith('/meta/')) {
        captured = await req.json();
        return new Response(JSON.stringify({ results: [], total: 0 }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${req.method} ${req.url}`);
    });
    await fetchRunMeta(instance.url, instance.managerUrl, 'u', 'p', 42);
    expect(captured).toEqual({ run_id: 42 });
  });
});

describe('fetchTimeSeries', () => {
  test('projects datapoints into {yearStart, yearStep, data}', async () => {
    spy = mockIxmp4Fetch({
      datapoints: [
        { id: 1, time_series__id: 31, value: 1.5, type: 'ANNUAL', step_year: 2020 },
        { id: 2, time_series__id: 31, value: 2.0, type: 'ANNUAL', step_year: 2025 },
        { id: 3, time_series__id: 31, value: 2.5, type: 'ANNUAL', step_year: 2030 },
      ],
    });
    const ts = await fetchTimeSeries(instance.url, instance.managerUrl, 'u', 'p', {
      variable: 'Temperature|Global Mean',
      runId: 11,
    });
    expect(ts).toEqual({ yearStart: 2020, yearStep: 5, data: [1.5, 2.0, 2.5] });
  });

  test('returns data:[] when no datapoints match', async () => {
    spy = mockIxmp4Fetch({ datapoints: [] });
    const ts = await fetchTimeSeries(instance.url, instance.managerUrl, 'u', 'p', {
      variable: 'X',
      runId: 1,
    });
    expect(ts).toEqual({ yearStart: 0, yearStep: 0, data: [] });
  });

  test('filters by variable name and run id when sending to ixmp4', async () => {
    let captured: unknown;
    spy = spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = new Request(input as RequestInfo, init);
      const url = new URL(req.url);
      if (req.method === 'POST' && url.pathname.endsWith('/token/obtain/')) {
        return new Response(JSON.stringify({ access: 'fake-token' }), { status: 200 });
      }
      if (req.method === 'PATCH' && url.pathname.endsWith('/iamc/datapoints/')) {
        captured = await req.json();
        return new Response(JSON.stringify({ results: [], total: 0 }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${req.method} ${req.url}`);
    });
    await fetchTimeSeries(instance.url, instance.managerUrl, 'u', 'p', {
      variable: 'Temperature|Global Mean',
      runId: 11,
    });
    expect(captured).toEqual({ variable: { name: 'Temperature|Global Mean' }, run_id: 11 });
  });

  test('adds region filter when region is provided', async () => {
    let captured: unknown;
    spy = spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = new Request(input as RequestInfo, init);
      const url = new URL(req.url);
      if (req.method === 'POST' && url.pathname.endsWith('/token/obtain/')) {
        return new Response(JSON.stringify({ access: 'fake-token' }), { status: 200 });
      }
      if (req.method === 'PATCH' && url.pathname.endsWith('/iamc/datapoints/')) {
        captured = await req.json();
        return new Response(JSON.stringify({ results: [], total: 0 }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${req.method} ${req.url}`);
    });
    await fetchTimeSeries(instance.url, instance.managerUrl, 'u', 'p', {
      variable: 'terclim-mean-temperature',
      runId: 11,
      region: 'DEU',
    });
    expect(captured).toEqual({
      variable: { name: 'terclim-mean-temperature' },
      run_id: 11,
      region: { name: 'DEU' },
    });
  });
});
