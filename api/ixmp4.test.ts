import { describe, test, expect } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { fetchTimeSeries } from './ixmp4';
import { instances } from './instances';
import { listEnvelope, server } from './test-helpers';

const instance = instances[0];

describe('fetchTimeSeries', () => {
  test('projects datapoints into {yearStart, yearStep, data}', async () => {
    server.use(
      http.patch(`${instance.url}/iamc/datapoints/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 1, time_series__id: 31, value: 1.5, type: 'ANNUAL', step_year: 2020 },
            { id: 2, time_series__id: 31, value: 2.0, type: 'ANNUAL', step_year: 2025 },
            { id: 3, time_series__id: 31, value: 2.5, type: 'ANNUAL', step_year: 2030 },
          ]),
        ),
      ),
    );
    const ts = await fetchTimeSeries(instance.url, instance.managerUrl, 'u', 'p', {
      variable: 'Temperature|Global Mean',
      runId: 11,
    });
    expect(ts).toEqual({ yearStart: 2020, yearStep: 5, data: [1.5, 2.0, 2.5] });
  });

  test('returns data:[] when no datapoints match', async () => {
    const ts = await fetchTimeSeries(instance.url, instance.managerUrl, 'u', 'p', {
      variable: 'X',
      runId: 1,
    });
    expect(ts).toEqual({ yearStart: 0, yearStep: 0, data: [] });
  });

  test('filters by variable name and run id when sending to ixmp4', async () => {
    let captured: unknown;
    server.use(
      http.patch(`${instance.url}/iamc/datapoints/`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json(listEnvelope([]));
      }),
    );
    await fetchTimeSeries(instance.url, instance.managerUrl, 'u', 'p', {
      variable: 'Temperature|Global Mean',
      runId: 11,
    });
    expect(captured).toEqual({ variable: { name: 'Temperature|Global Mean' }, run_id: 11 });
  });

  test('adds region filter when region is provided', async () => {
    let captured: unknown;
    server.use(
      http.patch(`${instance.url}/iamc/datapoints/`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json(listEnvelope([]));
      }),
    );
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
