import { afterEach, expect, test, vi } from 'vitest';
import { scoreboard } from './scoreboard';
import * as platform from '../platform';

const unitsFor = (variable: string) => variable.startsWith('High Heat Risk|') ? ['days/yr', '°C'] : ['°C'];
afterEach(() => vi.restoreAllMocks());

test.each([
  ['heat-stress', 'charts/high-heat-risk-range'],
  ['heat-stress', 'map', 'High Heat Risk'],
  ['testing', 'charts/high-heat-risk-by-country'],
  ['testing', 'charts/temperature-and-heat-risk'],
])('loads the saved %s %s config when heat risk has two source units', async (sector, resource, indicator) => {
  const tabulate = vi.fn(async (query) => ({
    columns: ['variable', 'scenario', 'region', 'model', 'unit', '2050'],
    values: query.region.name_in.flatMap((region) => unitsFor(query.variable.name)
      .filter((unit) => !query.unit || query.unit.name === unit)
      .map((unit) => [query.variable.name, query.scenario.name, region, 'RIME-X v1.0.0', unit, 12])),
  }));
  vi.spyOn(platform, 'createPlatform').mockResolvedValue({ iamc: { tabulate } } as never);
  const params = new URLSearchParams({ sector, region: 'Austria', scenario: 'CurrentPolicies', year: '2050' });
  if (indicator) params.set('indicator', indicator);
  const response = await scoreboard.request(`/${resource}?${params}`, {}, { DB: {}, IXMP4_USERNAME: 'test', IXMP4_PASSWORD: 'test' } as never);
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.status).toBe('ready');
  if (resource.includes('temperature-and-heat-risk')) {
    expect(result.series[0]).toMatchObject({ x: { unit: '°C' }, y: { unit: '°C' }, size: { unit: 'days/yr' } });
  } else if (resource === 'map') {
    expect(result.metadata.unit).toBe('days/yr');
  } else {
    expect(Object.values(result.series[0]).every((reference: any) => reference.unit === 'days/yr')).toBe(true);
  }
});
