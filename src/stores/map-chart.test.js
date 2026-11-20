import { afterEach, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import { runtimeCatalog } from './runtime-catalog.js';
import { MAP_CHART_VIEW, SELECTION_MODE } from './state.js';
import THEME from '$styles/theme-store.js';
import colors from '$styles/color-tokens-light.json';

afterEach(() => {
  runtimeCatalog.selectIndicator(undefined);
  runtimeCatalog.selectGeography(undefined);
  runtimeCatalog.selectScenarios([]);
  SELECTION_MODE.set('geography');
  vi.unstubAllGlobals();
});

test('prepares an Explorer map from the selected data without a GeoServer availability request', async () => {
  const indicator = { id: 'Mean Temperature', instance: 'provide-internal', unit: '°C' };
  const parameters = { time: 'Annual', reference: '2011-2020 (Present Day)', spatial: 'Area' };
  const requests = [];
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const url = new URL(input, 'https://provide.example');
    requests.push(url.pathname);
    if (url.pathname.endsWith('/indicators')) return Response.json({ indicators: [indicator], failedInstances: [] });
    if (url.pathname.includes('/indicator-details/')) {
      return Response.json({ ...indicator, parameters: Object.entries(parameters).map(([id, value]) => ({ id, options: [{ id: value, label: value }] })) });
    }
    if (url.pathname.endsWith('/scenario-availability')) {
      return Response.json({ scenarios: [{ id: 'Low Demand', label: 'Low Demand', yearStart: 2020, yearEnd: 2100 }] });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  }));
  THEME.set({ color: colors });
  SELECTION_MODE.set('indicator');
  await runtimeCatalog.loadIndicatorIndex();
  runtimeCatalog.selectGeography('Austria');
  runtimeCatalog.selectIndicator(indicator);
  await runtimeCatalog.loadIndicatorDetails();
  runtimeCatalog.selectScenarios(['Low Demand']);
  await runtimeCatalog.loadPercentileAvailability();

  expect(get(MAP_CHART_VIEW)).toEqual({
    status: 'ready',
    selection: { indicator: indicator.id, instance: indicator.instance, geography: 'Austria', scenarios: ['Low Demand'], ...parameters },
  });
  expect(requests.some((path) => path.includes('impact-geo'))).toBe(false);
});
