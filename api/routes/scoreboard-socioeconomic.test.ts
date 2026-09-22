import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as platformModule from '../platform';

const tabulate = vi.fn();
const env = { IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never };
const regions = [
  'China (R9)',
  'European Union (R9)',
  'India (R9)',
  'Latin America (R9)',
  'Middle East & Africa (R9)',
  'Other Asia (R9)',
  'Other OECD (R9)',
  'Reforming Economies (R9)',
  'USA (R9)',
];
const recorded = {
  Population: { unit: 'million', value: 546.3072052001953 },
  'Population|Rural': { unit: 'million', value: 55.50664138793945 },
  'Population|Urban': { unit: 'million', value: 490.8005981445312 },
  'Population|Vulnerable|Heat': { unit: 'million', value: 4.190780337471008 },
  'Population|Vulnerable|Heat|Rural': { unit: 'million', value: 0.6989316524419784 },
  'Population|Vulnerable|Heat|Urban': { unit: 'million', value: 3.491849060029984 },
  'GDP|PPP': { unit: 'billion USD_2010/yr', value: 31593.47499970703 },
};

const frame = (rows: unknown[][]) => ({
  columns: ['variable', 'scenario', 'region', 'model', 'unit', '2020', '2030', '2050', '2100'],
  values: rows,
});

function recordedFrame(query) {
  const source = recorded[query.variable.name];
  const exactReference = query.model?.name === 'IMAGE 3.4' && query.unit?.name === source?.unit;
  const exactScope = query.scenario?.name === 'CurrentPolicies_SSP1' && query.stepYear === 2050;
  if (!source || !exactReference || !exactScope || !query.region.name_in.includes('European Union (R9)')) return frame([]);
  return frame([
    [query.variable.name, 'CurrentPolicies_SSP1', 'European Union (R9)', 'IMAGE 3.4', source.unit, null, null, source.value, null],
  ]);
}

const chartPath = (chartId: string, region = 'Austria', scenario = 'CurrentPolicies_SSP1', year = 2050) =>
  `/api/scoreboard/charts/${chartId}?sector=socioeconomic&scenario=${scenario}&region=${region}&year=${year}`;
const request = async (path: string) => (await import('../index')).api.request(path, {}, env);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(platformModule, 'createPlatform').mockResolvedValue({ iamc: { tabulate } } as never);
  tabulate.mockImplementation(recordedFrame);
});
afterEach(() => vi.restoreAllMocks());

describe('socioeconomic scoreboard charts', () => {
  test('loads four chart examples from exact recorded source references', async () => {
    const population = await (await request(chartPath('population-by-region'))).json();
    const gdp = await (await request(chartPath('gdp-by-region'))).json();
    const vulnerable = await (await request(chartPath('vulnerable-population-heat-by-region'))).json();
    const bubble = await (await request(chartPath('gdp-population-heat-risk'))).json();

    expect(population).toMatchObject({ definition: { chartType: 'stacked_bar' }, status: 'ready' });
    expect(population.data[0].series).toEqual([
      { segment: recorded['Population|Rural'].value },
      { segment: recorded['Population|Urban'].value },
    ]);
    expect(gdp).toMatchObject({ definition: { chartType: 'stacked_bar' }, status: 'ready' });
    expect(vulnerable.data[0].series).toEqual([
      { segment: recorded['Population|Vulnerable|Heat|Rural'].value },
      { segment: recorded['Population|Vulnerable|Heat|Urban'].value },
    ]);
    expect(bubble).toMatchObject({ definition: { chartType: 'bubble' }, status: 'ready' });
    expect(bubble.data[0].series).toEqual([
      {
        x: recorded['GDP|PPP'].value,
        y: recorded['Population|Vulnerable|Heat'].value,
        size: recorded.Population.value,
      },
    ]);
    expect(tabulate).toHaveBeenCalledTimes(8);
    for (const [query] of tabulate.mock.calls) {
      expect(query).toMatchObject({
        run: { defaultOnly: true },
        scenario: { name: 'CurrentPolicies_SSP1' },
        region: { name_in: regions },
        stepYear: 2050,
      });
    }
  });

  test('keeps the fixed regions while scenario and year follow the filters', async () => {
    await request(chartPath('gdp-population-heat-risk'));
    const currentQueries = tabulate.mock.calls.map(([query]) => query);
    tabulate.mockClear();

    await request(chartPath('gdp-population-heat-risk', 'France', '1.5C_SSP2', 2100));
    const futureQueries = tabulate.mock.calls.map(([query]) => query);

    expect(currentQueries).toHaveLength(3);
    expect(futureQueries).toHaveLength(3);
    for (const query of currentQueries) {
      expect(query).toMatchObject({ scenario: { name: 'CurrentPolicies_SSP1' }, region: { name_in: regions }, stepYear: 2050 });
    }
    for (const query of futureQueries) {
      expect(query).toMatchObject({ scenario: { name: '1.5C_SSP2' }, region: { name_in: regions }, stepYear: 2100 });
    }
  });
});
