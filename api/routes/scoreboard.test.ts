import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getScoreboard } from '../scoreboard/controller.js';
import { schema } from '../db';

const calls: Array<Record<string, unknown>> = [];
let ambiguousVariable: string | null = null;
let failedVariable: string | null = null;
let includeSts3 = false;
let delayPopulation = false;
let missingVariableInChina: string | null = null;
let includeScenarioGroups = false;
let missingScenarioRole: string | null = null;
let includeUnsupportedMapRegions = false;
const createPlatform = vi.fn();
let errorLog: ReturnType<typeof vi.spyOn>;

vi.mock('../platform', () => ({
  createPlatform: createPlatform.mockImplementation(async (instance) => ({
    instance,
    iamc: {
      tabulate: async (query: Record<string, unknown>) => {
        calls.push(query);
        const variable = (query.variable as { name: string }).name;
        if (variable === failedVariable) throw new Error('secret upstream details');
        const model = (query.model as { name: string }).name;
        let scenario = model === 'RIME-X v1.0.0' ? 'CurrentPolicies' : '1.5C_SSP1';
        if (includeSts3 && variable === 'GDP|PPP') scenario = 'STS3';
        const region = model === 'RIME-X v1.0.0' ? 'Austria' : 'European Union (R9)';
        const value2040 = model === 'RIME-X v1.0.0' ? 31 : null;
        const row = [scenario, region, model, (query.unit as { name: string }).name, value2040, 32];
        const rows = [row];
        if (model === 'RIME-X v1.0.0') {
          rows.push([scenario, 'France', model, (query.unit as { name: string }).name, value2040, 0]);
          if (includeUnsupportedMapRegions && variable.startsWith('Maximum Air Temperature')) {
            rows.push([scenario, 'AT11', model, (query.unit as { name: string }).name, value2040, 29]);
            rows.push([scenario, 'EU27', model, (query.unit as { name: string }).name, value2040, 30]);
          }
        }
        if (includeScenarioGroups && model === 'IMAGE 3.4') {
          const scenarioValue = variable === missingScenarioRole ? null : 24;
          rows.push(['STS1_SSP1', 'European Union (R9)', model, (query.unit as { name: string }).name, null, scenarioValue]);
          rows.push(['CurrentPolicies', 'Austria', model, (query.unit as { name: string }).name, null, 20]);
        }
        if (model !== 'RIME-X v1.0.0') {
          const groupedRegions = ['World', 'China (R9)', 'India (R9)', 'Latin America (R9)', 'Middle East & Africa (R9)', 'Other Asia (R9)', 'Other OECD (R9)', 'Reforming Economies (R9)', 'USA (R9)'];
          for (const groupedRegion of groupedRegions) {
            const groupedValue = groupedRegion === 'China (R9)' && variable === missingVariableInChina ? null : 32;
            rows.push([scenario, groupedRegion, model, (query.unit as { name: string }).name, null, groupedValue]);
          }
        }
        if (delayPopulation) {
          const delay = variable.startsWith('Population|Vulnerable') ? 8 : 0;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        return {
          columns: ['scenario', 'region', 'model', 'unit', '2040', '2050'],
          values: variable === ambiguousVariable ? [row, [...row.slice(0, 5), 33]] : rows,
        };
      },
    },
  })),
}));

beforeEach(() => {
  calls.splice(0);
  ambiguousVariable = null;
  failedVariable = null;
  includeSts3 = false;
  delayPopulation = false;
  missingVariableInChina = null;
  includeScenarioGroups = false;
  missingScenarioRole = null;
  includeUnsupportedMapRegions = false;
  createPlatform.mockClear();
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/scoreboard', () => {
  test('logs safe connection details and returns a generic source error', async () => {
    const cause = Object.assign(new Error('connect secret'), { code: 'ECONNREFUSED' });
    const failure = Object.assign(new TypeError('fetch failed with token=secret', { cause }), { response: { status: 401, body: 'secret' } });
    createPlatform.mockRejectedValueOnce(failure);
    const { api } = await import('../index');
    const response = await api.request('/api/scoreboard?sector=testing&chartId=vulnerable-population-heat', {}, {
      IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never,
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Scoreboard source unavailable' });
    expect(errorLog).toHaveBeenCalledWith('Scoreboard source connection failed', expect.objectContaining({
      operation: 'connect-scoreboard-source', sector: 'testing', chartId: 'vulnerable-population-heat',
      reasonName: 'TypeError', causeName: 'Error', causeCode: 'ECONNREFUSED', reasonStatus: 401,
    }));
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('secret');
  });

  test('derives valid defaults, resolves every role and isolates an upstream chart error', async () => {
    failedVariable = 'Maximum Air Temperature|Absolute Values (No Change)|Annual|Area|95th Percentile';
    const { api } = await import('../index');
    const response = await api.request('/api/scoreboard?sector=testing', {}, {
      IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never,
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.selection).toEqual({
      scenario: { uid: '1.5C_SSP1', label: '1.5C_SSP1' },
      region: { uid: 'World', label: 'World' },
      year: { uid: '2050', label: '2050' },
    });
    expect(result.charts.find(({ definition }) => definition.chartType === 'line').data[0].line).toEqual([
      { year: 2040, value: null }, { year: 2050, value: 32 },
    ]);
    const bars = result.charts.find(({ definition }) => definition.chartType === 'stacked_bar').data;
    expect(bars).toHaveLength(9);
    expect(bars[0]).toMatchObject({ region: { uid: 'China (R9)' }, series: [{ segment: 32 }, { segment: 32 }] });
    const bubbles = result.charts.find(({ definition }) => definition.chartType === 'bubble').data;
    expect(bubbles).toHaveLength(9);
    expect(bubbles[0]).toMatchObject({ region: { uid: 'China (R9)' }, series: [{ x: 32, y: 32, size: 32 }] });
    expect(result.charts.find(({ definition }) => definition.chartType === 'line_with_range')).toMatchObject({
      status: 'error', data: [], error: 'Chart data unavailable',
    });
    expect(result.charts.filter(({ status }) => status === 'ready')).toHaveLength(3);
    expect(calls.every((query) => (query.run as { defaultOnly: boolean }).defaultOnly)).toBe(true);
    expect(errorLog).toHaveBeenCalledWith('Scoreboard variable read failed', expect.objectContaining({
      operation: 'read-default-run-series',
      sector: 'testing',
      variable: failedVariable,
      model: 'RIME-X v1.0.0',
      unit: '°C',
      reasonName: 'Error',
    }));
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('secret upstream details');
  });



  test('chooses the same default when variable requests finish in another order', async () => {
    includeSts3 = true;
    delayPopulation = true;
    const { api } = await import('../index');
    const env = { IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never };
    const first = await (await api.request('/api/scoreboard?sector=testing', {}, env)).json();

    delayPopulation = false;
    const second = await (await api.request('/api/scoreboard?sector=testing', {}, env)).json();

    expect(first.selection.scenario).toEqual({ uid: '1.5C_SSP1', label: '1.5C_SSP1' });
    expect(second.selection.scenario).toEqual(first.selection.scenario);
    expect(first.scenarios.map(({ uid }) => uid)).toEqual(['1.5C_SSP1', 'CurrentPolicies', 'STS3']);

    const requested = await (await api.request('/api/scoreboard?sector=testing&scenario=STS3', {}, env)).json();
    expect(requested.selection.scenario).toEqual({ uid: 'STS3', label: 'STS3' });
  });

  test('returns successful range roles for an available selection', async () => {
    const { api } = await import('../index');
    const response = await api.request('/api/scoreboard?sector=testing&chartId=maximum-air-temperature-range&scenario=CurrentPolicies&region=Austria&year=2040', {}, {
      IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never,
    });
    const result = await response.json();
    expect(result.selection.year).toEqual({ uid: '2040', label: '2040' });
    expect(result.charts[0].status).toBe('ready');
    expect(result.charts[0].data[0]).toEqual({
      line: [{ year: 2040, value: 31 }, { year: 2050, value: 32 }],
      rangeLow: [{ year: 2040, value: 31 }, { year: 2050, value: 32 }],
      rangeHigh: [{ year: 2040, value: 31 }, { year: 2050, value: 32 }],
    });
  });

  test('an unknown embed chart skips map and platform reads', async () => {
    const { api } = await import('../index');
    const response = await api.request('/api/scoreboard?sector=testing&chartId=unknown', {}, {
      IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never,
    });
    expect(await response.json()).toEqual({
      scenarios: [], regions: [], years: [],
      selection: { scenario: null, region: null, year: null }, charts: [],
    });
    expect(createPlatform).not.toHaveBeenCalled();
  });

  test('loads an admin0 map while Heat stress has no charts and keeps zero values', async () => {
    includeUnsupportedMapRegions = true;
    const geographies = [
      { id: 'continent:Europe', label: 'Europe', geographyType: 'continent', geoId: null },
      { id: 'Austria', label: 'Austria', geographyType: 'admin0', geoId: 'AUT' },
      { id: 'France', label: 'France', geographyType: 'admin0', geoId: 'FRA' },
    ];
    const parents = [{ geographyId: 'Austria', parentId: 'continent:Europe' }, { geographyId: 'France', parentId: 'continent:Europe' }];
    const db = { select: () => ({ from: async (table) => table === schema.geographies ? geographies : parents }) } as never;
    const { api } = await import('../index');
    const response = await api.request('/api/scoreboard?sector=heat-stress', {}, {
      IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: db,
    });
    const result = await response.json();
    expect(result.charts).toEqual([]);
    expect(result.selection).toMatchObject({ scenario: { uid: 'CurrentPolicies' }, region: { uid: 'continent:Europe', label: 'Europe' }, year: { uid: '2050' } });
    expect(result.regions).toEqual([
      { uid: 'Austria', label: 'Austria' },
      { uid: 'continent:Europe', label: 'Europe' },
      { uid: 'France', label: 'France' },
      { uid: 'World', label: 'World' },
    ]);
    expect(result.map).toMatchObject({ status: 'ready', values: [
      { uid: 'AUT', label: 'Austria', value: 32 }, { uid: 'FRA', label: 'France', value: 0 },
    ] });
    expect(calls[0]).toMatchObject({
      variable: { name: 'Maximum Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile' },
      model: { name: 'RIME-X v1.0.0' }, unit: { name: '°C' }, run: { defaultOnly: true },
    });
  });

  test('loads R9 map values and deduplicates its shared chart reference', async () => {
    const { api } = await import('../index');
    const response = await api.request('/api/scoreboard?sector=testing', {}, {
      IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never,
    });
    const result = await response.json();
    expect(result.map.status).toBe('ready');
    expect(result.map.values).toHaveLength(9);
    expect(result.map.values[0]).toMatchObject({ uid: 'China (R9)', value: 32 });
    expect(calls.filter((query) => (query.variable as { name: string }).name === 'Population|Vulnerable|Heat')).toHaveLength(1);
  });

  test('isolates a map read error from chart results', async () => {
    failedVariable = 'Maximum Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile';
    const { api } = await import('../index');
    const response = await api.request('/api/scoreboard?sector=heat-stress', {}, {
      IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never,
    });
    const result = await response.json();
    expect(result.charts).toEqual([]);
    expect(result.map).toMatchObject({ status: 'error', values: [], error: 'Map data unavailable' });
  });


  test('keeps bubble series positions when an earlier series is incomplete', async () => {
    missingVariableInChina = 'GDP|PPP';
    const refs = {
      gdp: { variable: 'GDP|PPP', model: 'IMAGE 3.4', unit: 'billion USD_2010/yr' },
      heat: { variable: 'Population|Vulnerable|Heat', model: 'IMAGE 3.4', unit: 'million' },
      population: { variable: 'Population', model: 'IMAGE 3.4', unit: 'million' },
    };
    const definition = {
      chartId: 'two-bubbles', title: 'Two bubbles', description: 'Comparison', chartType: 'bubble',
      data: { groupBy: 'region', series: [
        { x: refs.gdp, y: refs.heat, size: refs.population },
        { x: refs.population, y: refs.heat, size: refs.population },
      ] },
    };
    const definitions = getScoreboard('testing').definitions;
    definitions.push(definition);
    try {
      const { api } = await import('../index');
      const response = await api.request('/api/scoreboard?sector=testing&chartId=two-bubbles', {}, {
        IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never,
      });
      const result = await response.json();
      const china = result.charts[0].data.find(({ region }) => region.uid === 'China (R9)');
      expect(china.series).toEqual([{ x: null, y: 32, size: 32 }, { x: 32, y: 32, size: 32 }]);
    } finally {
      definitions.pop();
    }
  });

  test('scenario grouping ignores the scenario selector and excludes incomplete stacks', async () => {
    includeScenarioGroups = true;
    missingScenarioRole = 'Population|Vulnerable|Heat|Urban';
    const definition = {
      chartId: 'scenario-bars', title: 'Scenario bars', description: 'Comparison', chartType: 'stacked_bar',
      data: { groupBy: 'scenario', series: [
        { segment: { variable: 'Population|Vulnerable|Heat|Rural', model: 'IMAGE 3.4', unit: 'million' } },
        { segment: { variable: 'Population|Vulnerable|Heat|Urban', model: 'IMAGE 3.4', unit: 'million' } },
      ] },
    };
    const definitions = getScoreboard('testing').definitions;
    definitions.push(definition);
    try {
      const { api } = await import('../index');
      const response = await api.request('/api/scoreboard?sector=testing&chartId=scenario-bars&scenario=CurrentPolicies&region=European%20Union%20(R9)&year=2050', {}, {
        IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never,
      });
      const result = await response.json();
      expect(result.selection).toMatchObject({ scenario: { uid: 'CurrentPolicies' }, region: { uid: 'European Union (R9)' }, year: { uid: '2050' } });
      expect(result.charts[0].data).toEqual([
        { scenario: { uid: '1.5C_SSP1', label: '1.5C_SSP1' }, series: [{ segment: 32 }, { segment: 32 }] },
      ]);
    } finally {
      definitions.pop();
    }
  });

  test('marks ambiguous default-run rows as a chart error', async () => {
    ambiguousVariable = 'Population|Vulnerable|Heat';
    const { api } = await import('../index');
    const response = await api.request('/api/scoreboard?sector=testing&chartId=vulnerable-population-heat', {}, {
      IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never,
    });
    const result = await response.json();
    expect(result.charts[0]).toMatchObject({ status: 'error', data: [], error: 'Chart data unavailable' });
    expect(errorLog).toHaveBeenCalledWith('Scoreboard chart processing failed', expect.objectContaining({
      operation: 'process-chart-data', chartId: 'vulnerable-population-heat', reasonName: 'Error',
    }));
  });

  test('limits an embed request to its chart and ignores a caller instance', async () => {
    const { api } = await import('../index');
    const response = await api.request('/api/scoreboard?sector=testing&chartId=maximum-air-temperature-range&instance=provide-internal', {}, {
      IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never,
    });
    const result = await response.json();
    expect(result.charts).toHaveLength(1);
    expect(result.charts[0].definition.chartId).toBe('maximum-air-temperature-range');
    expect(result.charts[0].status).toBe('ready');
    expect(createPlatform.mock.calls[0][0].slug).toBe('sparccle-internal');
    expect(result.charts[0].data[0].line).toEqual([{ year: 2040, value: 31 }, { year: 2050, value: 32 }]);
    expect(result).not.toHaveProperty('map');
    expect(calls.some((query) => (query.variable as { name: string }).name === 'Population|Vulnerable|Heat')).toBe(false);
  });
});
