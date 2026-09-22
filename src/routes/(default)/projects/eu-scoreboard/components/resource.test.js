import { expect, test, vi } from 'vitest';
import { loadResource, mapResourceKey } from './resource.js';

const option = (uid) => ({ uid, label: uid });
const selection = {
  indicator: option('Maximum Air Temperature'),
  region: option('Austria'),
  scenario: option('CurrentPolicies'),
  year: option('2050'),
};

test('map requests and cache identity include sector, indicator, country, scenario and year', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ status: 'empty', values: [] }));
  await loadResource('map', 'testing', selection, fetcher);

  expect(fetcher).toHaveBeenCalledWith(
    '/app/scoreboard/map?sector=testing&indicator=Maximum+Air+Temperature&region=Austria&scenario=CurrentPolicies&year=2050'
  );
  expect(mapResourceKey('testing', selection)).toBe('testing|Maximum Air Temperature|Austria|CurrentPolicies|2050');
});

test('chart requests keep their independent parameters', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ status: 'empty', data: [] }));
  await loadResource('charts/chart-id', 'testing', selection, fetcher);

  expect(fetcher.mock.calls[0][0]).toBe('/app/scoreboard/charts/chart-id?sector=testing&region=Austria&scenario=CurrentPolicies&year=2050');
});
