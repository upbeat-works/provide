import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import * as platformModule from '../platform';
import { boundarySource } from '../scoreboard/boundaries';
import { server } from '../test-helpers';

const tabulate = vi.fn();
let createPlatform;

const env = { IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never };
const variable = 'Maximum Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile';
const meanVariable = 'Mean Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile';
const highHeatRiskVariable = 'High Heat Risk|Absolute Values (No Change)|Annual|Area|50th Percentile';
const mapPath = (overrides: Record<string, string> = {}) => {
  const values = { sector: 'testing', indicator: 'Maximum Air Temperature', scenario: 'CurrentPolicies', region: 'Austria', year: '2050', ...overrides };
  return `/api/scoreboard/map?${new URLSearchParams(values)}`;
};
const chartPath = (chartId: string, region = 'Austria', scenario = 'CurrentPolicies', year = 2050) =>
  `/api/scoreboard/charts/${chartId}?sector=testing&scenario=${scenario}&region=${region}&year=${year}`;
const frame = (rows: unknown[][]) => ({ columns: ['variable', 'scenario', 'region', 'model', 'unit', '2040', '2050', '2100'], values: rows });
const recorded2050 = {
  [meanVariable]: { unit: '°C', Austria: 8.786127090454102, Germany: 10.9244384765625, France: 14.90442848205566 },
  [variable]: { unit: '°C', Austria: 12.93789386749268, Germany: 15.02653026580811, France: 19.48232650756836 },
  [highHeatRiskVariable]: { unit: 'days/yr', Austria: 4.434183597564697, Germany: 4.537012100219727, France: 57.37626266479492 },
};

function recordedFrame(query) {
  const source = recorded2050[query.variable.name];
  const exactReference = query.model?.name === 'RIME-X v1.0.0' && query.unit?.name === source?.unit;
  const requestedRecordedYear = query.stepYear === undefined || query.stepYear === 2050;
  if (!source || !exactReference || !requestedRecordedYear || query.scenario?.name !== 'CurrentPolicies') return frame([]);
  const rows = query.region.name_in.flatMap((region) => {
    const value = source[region];
    return value === undefined ? [] : [[query.variable.name, 'CurrentPolicies', region, 'RIME-X v1.0.0', source.unit, null, value, null]];
  });
  return frame(rows);
}
const boundaries = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { NUTS_ID: 'AT11', CNTR_CODE: 'AT', LEVL_CODE: 2 }, geometry: null },
    { type: 'Feature', properties: { NUTS_ID: 'AT12', CNTR_CODE: 'AT', LEVL_CODE: 2 }, geometry: null },
    { type: 'Feature', properties: { NUTS_ID: 'AT1', CNTR_CODE: 'AT', LEVL_CODE: 1 }, geometry: null },
    { type: 'Feature', properties: { NUTS_ID: 'FR10', CNTR_CODE: 'FR', LEVL_CODE: 2 }, geometry: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  createPlatform = vi.spyOn(platformModule, 'createPlatform');
  createPlatform.mockResolvedValue({ iamc: { tabulate } });
  tabulate.mockResolvedValue(
    frame([
      [variable, 'CurrentPolicies', 'AT11', 'RIME-X v1.0.0', '°C', 1, 0, 2],
      [variable, 'CurrentPolicies', 'AT12', 'RIME-X v1.0.0', '°C', 1, null, 2],
    ])
  );
  server.use(http.get(boundarySource('NUTS2'), () => HttpResponse.json(boundaries)));
});
afterEach(() => vi.restoreAllMocks());

const request = async (path: string) => (await import('../index')).api.request(path, {}, env);

describe('scoreboard requests', () => {
  test('does not expose the removed options endpoint', async () => {
    expect((await request('/api/scoreboard/options?sector=testing')).status).toBe(404);
    expect(createPlatform).not.toHaveBeenCalled();
  });

  test('validates every configured map choice before reading a source', async () => {
    for (const path of [
      mapPath({ indicator: 'Missing' }),
      mapPath({ scenario: 'Missing' }),
      mapPath({ region: 'Canada' }),
      mapPath({ year: '2040' }),
      mapPath({ sector: 'missing' }),
      '/api/scoreboard/map?sector=testing',
    ]) {
      expect((await request(path)).status).toBe(400);
    }
    expect(createPlatform).not.toHaveBeenCalled();
  });

  test('queries configured NUTS regions and returns source metadata, zero and missing values', async () => {
    const response = await request(mapPath());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      definition: { name: 'Maximum Air Temperature', type: 'choropleth', level: 'NUTS2' },
      status: 'ready',
      values: [{ region: 'AT11', value: 0 }],
      metadata: { variable, model: 'RIME-X v1.0.0', unit: '°C' },
    });
    expect(tabulate).toHaveBeenCalledWith({
      variable: { name: variable },
      run: { defaultOnly: true },
      scenario: { name: 'CurrentPolicies' },
      region: { name_in: ['AT11', 'AT12'] },
      stepYear: 2050,
      wide: true,
    });
  });

  test('returns an empty map when the configured query has no rows', async () => {
    tabulate.mockResolvedValue(frame([]));

    expect(await (await request(mapPath())).json()).toEqual({
      definition: { name: 'Maximum Air Temperature', type: 'choropleth', level: 'NUTS2' },
      status: 'empty',
      values: [],
      metadata: null,
    });
  });

  test('accepts Ukraine when its boundary source has no regional features', async () => {
    const response = await request(mapPath({ region: 'Ukraine' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'empty', values: [] });
    expect(createPlatform).not.toHaveBeenCalled();
  });

  test('rejects duplicate values for one regional ID', async () => {
    tabulate.mockResolvedValue(
      frame([
        [variable, 'CurrentPolicies', 'AT11', 'RIME-X v1.0.0', '°C', 1, 2, 3],
        [variable, 'CurrentPolicies', 'AT11', 'RIME-X v1.0.0', '°C', 1, 4, 5],
      ])
    );

    const response = await request(mapPath());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Map data unavailable' });
  });

  test('loads the three climate examples for one current filter selection', async () => {
    tabulate.mockImplementation(recordedFrame);

    const line = await (await request(chartPath('mean-air-temperature'))).json();
    const bar = await (await request(chartPath('high-heat-risk-by-country'))).json();
    const bubble = await (await request(chartPath('temperature-and-heat-risk'))).json();

    expect(line).toMatchObject({ definition: { chartType: 'line' }, status: 'ready' });
    expect(line.data[0].line).toContainEqual({ year: 2050, value: recorded2050[meanVariable].Austria });
    expect(bar).toMatchObject({ definition: { chartType: 'stacked_bar' }, status: 'ready' });
    expect(bar.data).toHaveLength(3);
    expect(bar.data[0].series).toEqual([{ segment: recorded2050[highHeatRiskVariable].Austria }]);
    expect(bubble).toMatchObject({ definition: { chartType: 'bubble' }, status: 'ready' });
    expect(bubble.data).toHaveLength(3);
  });

  test.each([
    ['high-heat-risk-by-country', 1],
    ['temperature-and-heat-risk', 3],
  ])('keeps %s on its fixed country scope when selection country changes', async (chartId, queryCount) => {
    tabulate.mockImplementation(recordedFrame);

    expect((await request(chartPath(chartId, 'Austria', 'CurrentPolicies', 2050))).status).toBe(200);
    const firstQueries = tabulate.mock.calls.map(([query]) => query);
    expect(firstQueries).toHaveLength(queryCount);
    tabulate.mockClear();
    expect((await request(chartPath(chartId, 'Netherlands', 'CurrentPolicies', 2050))).status).toBe(200);
    const secondQueries = tabulate.mock.calls.map(([query]) => query);

    const expectedRegions = ['Austria', 'Germany', 'France'];
    for (const query of [...firstQueries, ...secondQueries]) {
      expect(query).toMatchObject({ scenario: { name: 'CurrentPolicies' }, region: { name_in: expectedRegions }, stepYear: 2050 });
    }
    expect(firstQueries).toEqual(secondQueries);
  });

  test('chart requests keep their exact configured references', async () => {
    tabulate.mockResolvedValue(frame([[variable, 'CurrentPolicies', 'Austria', 'RIME-X v1.0.0', '°C', 1, 2, 3]]));

    const response = await request('/api/scoreboard/charts/maximum-air-temperature-range?sector=testing&scenario=CurrentPolicies&region=Austria&year=2050');

    expect(response.status).toBe(200);
    expect(tabulate).toHaveBeenCalledTimes(3);
    for (const [query] of tabulate.mock.calls) {
      expect(query).toMatchObject({
        model: { name: 'RIME-X v1.0.0' },
        unit: { name: '°C' },
        run: { defaultOnly: true },
        scenario: { name: 'CurrentPolicies' },
        region: { name_in: ['Austria'] },
      });
      expect(query).not.toHaveProperty('stepYear');
    }
  });
});
