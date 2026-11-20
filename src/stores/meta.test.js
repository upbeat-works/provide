import { afterEach, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import { SCENARIOS } from './meta.js';
import { runtimeCatalog } from './runtime-catalog.js';

afterEach(() => {
  runtimeCatalog.selectIndicator(undefined);
  vi.unstubAllGlobals();
});

test('keeps scenario availability years when detail uses a wider display range', async () => {
  const id = 'Available to 2100';
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const url = new URL(input, 'http://localhost');
    if (url.pathname.endsWith('/scenario-availability')) {
      return Response.json({ scenarios: [{ id, label: id, yearStart: 2020, yearEnd: 2100 }] });
    }
    if (url.pathname.includes('/scenario-details/')) {
      return Response.json({
        id, instance: 'provide-internal', yearStart: 2030, yearEnd: 2300, yearStep: 10,
        gmt: { yearStart: 2020, yearStep: 5, data: [[1, 1.2, 1.4], [1.1, 1.3, 1.5]] },
      });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  }));
  runtimeCatalog.selectIndicator({ id: 'Mean Temperature', instance: 'provide-internal' });
  runtimeCatalog.selectGeography('Germany');
  await runtimeCatalog.loadPercentileAvailability();
  await runtimeCatalog.loadScenarioDetails(id);

  expect(get(SCENARIOS)).toMatchObject([{
    uid: id, startYear: 2020, endYear: 2100,
    gmt: [{ year: 2020, value: 1.2 }, { year: 2025, value: 1.3 }],
  }]);
});
