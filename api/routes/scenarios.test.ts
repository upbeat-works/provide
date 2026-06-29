import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { api } from '../index';
import { instances } from '../instances';
import * as scenarios from '../views/scenarios';
import { createTestEnv } from '../test-helpers';

const instance = instances[0];

let spy: ReturnType<typeof spyOn<typeof scenarios, 'fetchScenarioAvailability'>>;

beforeEach(() => {
  spy = spyOn(scenarios, 'fetchScenarioAvailability').mockResolvedValue([
    { uid: '2020 Climate Policies', yearStart: 2020, yearStep: 5, yearEnd: 2100 },
  ]);
});
afterEach(() => spy.mockRestore());

describe('GET /api/scenarios', () => {
  test('returns 400 when indicator or region is missing', async () => {
    const res = await api.request('/api/scenarios', {}, createTestEnv());
    expect(res.status).toBe(400);
  });

  test('returns data-driven scenario availability with per-scenario timeframes', async () => {
    const res = await api.request(
      `/api/scenarios?indicator=Mean%20Temperature&region=France&instance=${instance.slug}`,
      {},
      createTestEnv(),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { scenarios: Array<{ uid: string; yearEnd: number }> };
    expect(json.scenarios).toEqual([{ uid: '2020 Climate Policies', yearStart: 2020, yearStep: 5, yearEnd: 2100 }]);
  });

  test('forwards the selected facets to the resolver', async () => {
    await api.request(
      '/api/scenarios?indicator=Mean%20Temperature&region=France&time=December%20-%20February&reference=1850-1900%20(Pre-industrial)&spatial=Area',
      {},
      createTestEnv(),
    );
    const [, , params] = spy.mock.calls[0];
    expect(params).toMatchObject({
      indicator: 'Mean Temperature',
      region: 'France',
      temporal: 'December - February',
      period: '1850-1900 (Pre-industrial)',
      spatial: 'Area',
    });
  });
});
