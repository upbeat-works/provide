import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as platformModule from '../platform';
import { getScoreboard } from '../scoreboard/controller.js';
import { schema } from '../db';

const tabulate = vi.fn();
const runs = vi.fn();
const regions = vi.fn();
let createPlatform;

const geographies = [
  { id: 'continent:Europe', label: 'Europe', geographyType: 'continent', geoId: null },
  { id: 'Austria', label: 'Austria', geographyType: 'admin0', geoId: 'AUT' },
  { id: 'France', label: 'France', geographyType: 'admin0', geoId: 'FRA' },
];
const parents = geographies.slice(1).map(({ id }) => ({ geographyId: id, parentId: 'continent:Europe' }));
const db = { select: () => ({ from: async (table) => (table === schema.geographies ? geographies : parents) }) };
const env = { IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: db as never };
const selection = 'scenario=CurrentPolicies&region=Austria&year=2050';
const chartPath = (id = 'maximum-air-temperature-range') => `/api/scoreboard/charts/${id}?sector=testing&${selection}`;
const frame = (rows) => ({ columns: ['scenario', 'region', '2040', '2050'], values: rows });

beforeEach(() => {
  vi.clearAllMocks();
  createPlatform = vi.spyOn(platformModule, 'createPlatform');
  createPlatform.mockResolvedValue({ iamc: { tabulate }, runs: { list: runs }, regions: { list: regions } });
  runs.mockResolvedValue([{ scenario: { name: 'CurrentPolicies' } }]);
  regions.mockResolvedValue([{ name: 'Austria' }, { name: 'France' }]);
  tabulate.mockResolvedValue(
    frame([
      ['CurrentPolicies', 'Austria', 31, 32],
      ['CurrentPolicies', 'France', null, 0],
    ])
  );
});
afterEach(() => vi.restoreAllMocks());

const request = async (path) => (await import('../index')).api.request(path, {}, env);

describe('scoreboard requests', () => {
  test('defaults to a scenario supported by the sector map and skips unrelated year data', async () => {
    runs.mockImplementation(async (query) => [{ scenario: { name: query.model.name === 'IMAGE 3.4' ? '1.5C_SSP1' : '1.5C' } }]);
    regions.mockResolvedValue([{ name: 'China (R9)' }, { name: 'World' }]);
    tabulate.mockResolvedValue(frame([['1.5C_SSP1', 'China (R9)', null, 32]]));
    const result = await (await request('/api/scoreboard/options?sector=testing')).json();
    expect(result.selection).toMatchObject({ scenario: { uid: '1.5C_SSP1' }, region: { uid: 'World' } });
    expect(tabulate.mock.calls.every(([query]) => query.model.name === 'IMAGE 3.4')).toBe(true);
  });

  test('loads control choices with metadata and limits year discovery to the selected area', async () => {
    const response = await request('/api/scoreboard/options?sector=heat-stress&scenario=CurrentPolicies&region=Austria');
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toMatchObject({ status: 'ready', selection: { scenario: { uid: 'CurrentPolicies' }, region: { uid: 'Austria' } } });
    expect(result.years).toEqual([
      { uid: '2040', label: '2040' },
      { uid: '2050', label: '2050' },
    ]);
    expect(result).not.toHaveProperty('charts');
    expect(result).not.toHaveProperty('map');
    expect(runs).toHaveBeenCalledWith(expect.objectContaining({ defaultOnly: true, model: { name: 'RIME-X v1.0.0' } }));
    expect(regions).toHaveBeenCalledWith(expect.objectContaining({ iamc: expect.objectContaining({ run: expect.objectContaining({ scenario: { name: 'CurrentPolicies' } }) }) }));
    expect(tabulate).toHaveBeenCalledWith(expect.objectContaining({ scenario: { name: 'CurrentPolicies' }, region: { name_in: ['Austria'] } }));
  });

  test('a failed availability read is an error, not evidence to replace a choice', async () => {
    regions.mockRejectedValue(new Error('source failed'));
    const response = await request('/api/scoreboard/options?sector=testing&scenario=CurrentPolicies&region=Austria');
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Scoreboard choices unavailable' });
    expect(tabulate).not.toHaveBeenCalled();
  });

  test('keeps scenario and region choices available when the year probe fails', async () => {
    tabulate.mockRejectedValue(new Error('source failed'));
    const response = await request('/api/scoreboard/options?sector=heat-stress&scenario=CurrentPolicies&region=Austria');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ready', yearStatus: 'error', selection: { scenario: { uid: 'CurrentPolicies' }, region: { uid: 'Austria' } } });
  });

  test('queries only the requested chart, scenario and region and keeps all line years', async () => {
    const result = await (await request(chartPath())).json();
    expect(result.status).toBe('ready');
    expect(result.data[0].line).toEqual([
      { year: 2040, value: 31 },
      { year: 2050, value: 32 },
    ]);
    expect(tabulate).toHaveBeenCalledTimes(3);
    for (const [query] of tabulate.mock.calls) {
      expect(query).toMatchObject({ scenario: { name: 'CurrentPolicies' }, region: { name_in: ['Austria'] }, run: { defaultOnly: true } });
      expect(query).not.toHaveProperty('stepYear');
    }
    expect(runs).not.toHaveBeenCalled();
    expect(regions).not.toHaveBeenCalled();
  });

  test('unknown charts and incomplete selections do not read the source', async () => {
    expect((await request(chartPath('unknown'))).status).toBe(404);
    expect((await request('/api/scoreboard/map?sector=heat-stress')).status).toBe(400);
    expect(createPlatform).not.toHaveBeenCalled();
  });

  test('a map reads only its selected year and countries, including zero values', async () => {
    const result = await (await request('/api/scoreboard/map?sector=heat-stress&scenario=CurrentPolicies&region=continent%3AEurope&year=2050')).json();
    expect(result).toMatchObject({
      status: 'ready',
      values: [
        { uid: 'AUT', label: 'Austria', value: 32 },
        { uid: 'FRA', label: 'France', value: 0 },
      ],
    });
    expect(tabulate).toHaveBeenCalledTimes(1);
    expect(tabulate).toHaveBeenCalledWith(expect.objectContaining({ scenario: { name: 'CurrentPolicies' }, region: { name_in: ['Austria', 'France'] }, stepYear: 2050 }));
  });

  test('one failed chart does not stop a map or change its selection', async () => {
    tabulate.mockImplementation(async (query) => {
      if (query.variable.name.endsWith('95th Percentile')) throw new Error('private source details');
      return frame([['CurrentPolicies', 'Austria', 31, 32]]);
    });
    expect((await request(chartPath())).status).toBe(502);
    const result = await (await request(`/api/scoreboard/map?sector=heat-stress&${selection}`)).json();
    expect(result).toMatchObject({ status: 'ready', values: [{ uid: 'AUT', value: 32 }] });
    expect(result).not.toHaveProperty('selection');
  });

  test('grouped bars request child regions at one year and omit incomplete stacks', async () => {
    tabulate.mockImplementation(async (query) =>
      frame([
        ['CurrentPolicies', 'China (R9)', 1, query.variable.name.endsWith('Urban') ? null : 10],
        ['CurrentPolicies', 'India (R9)', 2, 20],
      ])
    );
    const result = await (await request('/api/scoreboard/charts/vulnerable-population-heat-by-area?sector=testing&scenario=CurrentPolicies&region=World&year=2050')).json();
    expect(result.data).toEqual([{ region: { uid: 'India (R9)', label: 'India (R9)' }, series: [{ segment: 20 }, { segment: 20 }] }]);
    expect(tabulate.mock.calls[0][0].region.name_in).not.toContain('World');
    expect(tabulate.mock.calls[0][0]).toMatchObject({ stepYear: 2050, region: { name_in: expect.arrayContaining(['India (R9)', 'China (R9)']) } });
  });

  test('scenario grouping requests all scenarios only for the selected region and year', async () => {
    const definition = { ...getScoreboard('testing').definitions[1], chartId: 'scenario-bars', data: { ...getScoreboard('testing').definitions[1].data, groupBy: 'scenario' } };
    const definitions = getScoreboard('testing').definitions;
    definitions.push(definition);
    tabulate.mockResolvedValue(
      frame([
        ['A', 'Austria', 1, 10],
        ['B', 'Austria', 2, 20],
      ])
    );
    try {
      const result = await (await request(chartPath('scenario-bars'))).json();
      expect(result.data.map(({ scenario }) => scenario.uid)).toEqual(['A', 'B']);
      for (const [query] of tabulate.mock.calls) {
        expect(query).not.toHaveProperty('scenario');
        expect(query).toMatchObject({ region: { name_in: ['Austria'] }, stepYear: 2050 });
      }
    } finally {
      definitions.pop();
    }
  });

  test('rejects ambiguous default-run data', async () => {
    tabulate.mockResolvedValue(
      frame([
        ['CurrentPolicies', 'Austria', 31, 32],
        ['CurrentPolicies', 'Austria', 31, 33],
      ])
    );
    const response = await request(chartPath());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Chart data unavailable' });
  });

  test('keeps bubble series positions when one series is incomplete', async () => {
    const original = getScoreboard('testing').definitions[2];
    const first = original.data.series[0];
    const definition = { ...original, chartId: 'two-bubbles', data: { groupBy: 'region', series: [first, { ...first, x: first.size }] } };
    const definitions = getScoreboard('testing').definitions;
    definitions.push(definition);
    tabulate.mockImplementation(async (query) => frame([['CurrentPolicies', 'China (R9)', null, query.variable.name === 'GDP|PPP' ? null : 32]]));
    try {
      const result = await (await request('/api/scoreboard/charts/two-bubbles?sector=testing&scenario=CurrentPolicies&region=World&year=2050')).json();
      expect(result.data[0].series).toEqual([
        { x: null, y: 32, size: 32 },
        { x: 32, y: 32, size: 32 },
      ]);
    } finally {
      definitions.pop();
    }
  });
});
