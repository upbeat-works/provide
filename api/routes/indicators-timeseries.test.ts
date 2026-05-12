import { describe, test, expect, afterEach, spyOn } from 'bun:test';
import { api } from '../index';
import { createTestEnv, mockIxmp4Fetch, type Ixmp4Datapoint } from '../test-helpers';

let spy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined;

afterEach(() => {
  spy?.mockRestore();
  spy = undefined;
});

describe('GET /api/indicators/:uid/timeseries', () => {
  test('returns the time series projection from ixmp4 for indicator + scenario + region', async () => {
    spy = mockIxmp4Fetch({
      runs: [
        { id: 1, model: { name: 'M' }, scenario: { name: 'curpol' }, version: 1, is_default: true },
      ],
      datapoints: [
        { id: 1, time_series__id: 1, value: 1.5, type: 'A', step_year: 2020 },
        { id: 2, time_series__id: 1, value: 2.0, type: 'A', step_year: 2025 },
        { id: 3, time_series__id: 1, value: 2.5, type: 'A', step_year: 2030 },
      ],
    });
    const res = await api.request(
      '/api/indicators/terclim-mean-temperature/timeseries?scenario=curpol&region=DEU',
      {},
      createTestEnv(),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      yearStart: number;
      yearStep: number;
      data: number[];
    };
    expect(json).toEqual({ yearStart: 2020, yearStep: 5, data: [1.5, 2.0, 2.5] });
  });

  test('returns 404 when the indicator uid is not in the curated catalogue', async () => {
    spy = mockIxmp4Fetch({});
    const res = await api.request(
      '/api/indicators/unknown-indicator/timeseries?scenario=curpol&region=DEU',
      {},
      createTestEnv(),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  test('returns 404 when no ixmp4 run matches the requested scenario', async () => {
    spy = mockIxmp4Fetch({ runs: [] });
    const res = await api.request(
      '/api/indicators/terclim-mean-temperature/timeseries?scenario=curpol&region=DEU',
      {},
      createTestEnv(),
    );
    expect(res.status).toBe(404);
  });

  test('returns 400 when ?scenario or ?region are missing', async () => {
    spy = mockIxmp4Fetch({});
    const noScenario = await api.request(
      '/api/indicators/terclim-mean-temperature/timeseries?region=DEU',
      {},
      createTestEnv(),
    );
    expect(noScenario.status).toBe(400);

    const noRegion = await api.request(
      '/api/indicators/terclim-mean-temperature/timeseries?scenario=curpol',
      {},
      createTestEnv(),
    );
    expect(noRegion.status).toBe(400);
  });

  test('passes the indicator uid as the ixmp4 variable filter and includes region', async () => {
    let captured: Record<string, unknown> | undefined;
    const datapoints: Ixmp4Datapoint[] = [
      { id: 1, time_series__id: 1, value: 0.1, type: 'A', step_year: 2020 },
    ];
    spy = mockIxmp4Fetch({
      runs: [
        { id: 7, model: { name: 'M' }, scenario: { name: 'curpol' }, version: 1, is_default: true },
      ],
      datapoints: (body) => {
        captured = body;
        return datapoints;
      },
    });
    await api.request(
      '/api/indicators/terclim-mean-temperature/timeseries?scenario=curpol&region=FRA',
      {},
      createTestEnv(),
    );
    expect(captured).toEqual({
      variable: { name: 'terclim-mean-temperature' },
      run_id: 7,
      region: { name: 'FRA' },
    });
  });
});
