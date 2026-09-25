import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { writeArrayBuffer } from 'geotiff';
import * as platformModule from '../platform';
import { getScoreboard } from '../scoreboard/controller.js';
import * as controller from '../scoreboard/controller.js';

const tabulate = vi.fn();
let createPlatform;

const env = {
  IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never,
  GEOSERVER_URL: 'http://geo.test/geoserver', GEOSERVER_WORKSPACE: 'provide',
};
const variable = 'Maximum Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile';
const meanVariable = 'Mean Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile';
const highHeatRiskVariable = 'High Heat Risk|Absolute Values (No Change)|Annual|Area|50th Percentile';
const mapPath = (overrides: Record<string, string> = {}) => {
  const values = { sector: 'testing', indicator: 'Maximum Air Temperature', scenario: 'CurrentPolicies', region: 'Austria', year: '2050', ...overrides };
  return `/api/scoreboard/map?${new URLSearchParams(values)}`;
};
const rasterMapPath = (overrides: Record<string, string> = {}) => {
  const values = { sector: 'heat-stress', indicator: 'Mean Temperature', scenario: 'CurrentPolicies', region: 'Germany', year: '2030', ...overrides };
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
  const exactReference = (!query.unit || query.unit.name === source?.unit);
  const requestedRecordedYear = query.stepYear === undefined || query.stepYear === 2050;
  if (!source || !exactReference || !requestedRecordedYear || query.scenario?.name !== 'CurrentPolicies') return frame([]);
  const rows = query.region.name_in.flatMap((region) => {
    const value = source[region];
    return value === undefined ? [] : [[query.variable.name, 'CurrentPolicies', region, 'RIME-X v1.0.0', source.unit, null, value, null]];
  });
  return frame(rows);
}
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
});
afterEach(() => vi.restoreAllMocks());

const request = async (path: string) => (await import('../index')).api.request(path, {}, env);

function configureRaster() {
  const indicator = {
    name: 'Mean Temperature', type: 'raster', indicator: 'mean-temperature',
    reference: '1850-1900-pre-industrial', time: 'annual', spatial: 'area', unit: '°C',
  };
  vi.spyOn(controller, 'getScoreboard').mockReturnValue({
    indicator,
    map: { indicators: [indicator], scenarios: [{ id: 'CurrentPolicies', rasterName: 'current-policies' }], years: [2030] },
  } as never);
  return indicator;
}

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
      mapPath({ year: '2041' }),
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
      definition: { name: 'Maximum Air Temperature', variable, type: 'choropleth', level: 'NUTS2' },
      status: 'ready',
      values: [{ region: 'AT11', value: 0 }],
      metadata: { variable, model: 'RIME-X v1.0.0', unit: '°C' },
    });
    expect(tabulate).toHaveBeenCalledWith({
      variable: { name: variable },
      run: { defaultOnly: true },
      scenario: { name: 'CurrentPolicies' },
      region: { name_in: ['AT12', 'AT13', 'AT21', 'AT22', 'AT31', 'AT32', 'AT33', 'AT34', 'AT11'] },
      stepYear: 2050,
      wide: true,
    });
  });

  test('uses the configured source variable when its display name is unrelated', async () => {
    const indicator = { name: 'Population overview', variable: 'Population', type: 'choropleth', level: 'NUTS2' };
    const indicators = getScoreboard('testing').map.indicators;
    indicators.push(indicator);
    tabulate.mockImplementation((query) => {
      if (query.variable.name !== 'Population') return frame([]);
      return frame([['Population', 'CurrentPolicies', 'AT11', 'Population model', 'million', null, 12, null]]);
    });

    try {
      const response = await request(mapPath({ indicator: indicator.name }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        definition: indicator,
        status: 'ready',
        values: [{ region: 'AT11', value: 12 }],
        metadata: { variable: 'Population', model: 'Population model', unit: 'million' },
      });
      expect(tabulate).toHaveBeenCalledWith(expect.objectContaining({ variable: { name: 'Population' } }));
    } finally {
      indicators.pop();
    }
  });

  test('rejects a blank configured source variable before querying the source', async () => {
    const indicator = { name: 'Broken map', variable: '   ', type: 'choropleth', level: 'NUTS2' };
    const indicators = getScoreboard('testing').map.indicators;
    indicators.push(indicator);

    try {
      const response = await request(mapPath({ indicator: indicator.name }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid scoreboard map configuration' });
      expect(createPlatform).not.toHaveBeenCalled();
      expect(tabulate).not.toHaveBeenCalled();
    } finally {
      indicators.pop();
    }
  });

  test('returns an empty map when the configured query has no rows', async () => {
    tabulate.mockResolvedValue(frame([]));

    expect(await (await request(mapPath())).json()).toEqual({
      definition: { name: 'Maximum Air Temperature', variable, type: 'choropleth', level: 'NUTS2' },
      status: 'empty',
      values: [],
      metadata: null,
    });
  });

  test('loads a configured GeoServer raster for the selected country and IAMC scenario', async () => {
    const indicator = configureRaster();
    const tiff = writeArrayBuffer(new Float32Array([3, -9999, 1, 2]), {
      width: 2, height: 2, ModelPixelScale: [2, 2, 0], ModelTiepoint: [0, 0, 0, 10, 24, 0],
      GeographicTypeGeoKey: 4326, GTModelTypeGeoKey: 2, GTRasterTypeGeoKey: 1, GDAL_NODATA: '-9999',
    });
    const fetcher = vi.fn(async () => new Response(tiff, { headers: { 'content-type': 'image/tiff' } }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetcher as typeof fetch;

    try {
      const response = await request(rasterMapPath());

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        definition: indicator,
        status: 'ready',
        grid: { coordinatesOrigin: [11, 21], resolution: 2, data: [[1, 3], [2, null]] },
        metadata: { unit: '°C' },
      });
      const url = new URL(String(fetcher.mock.calls[0][0]));
      expect(url.searchParams.get('coverageId')).toBe(
        'provide__current-policies_germany_mean-temperature-1850-1900-pre-industrial_annual_area_50th-percentile_2030'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('returns an empty raster map when GeoServer has no matching coverage', async () => {
    configureRaster();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(
      '<ows:ExceptionReport><ows:Exception exceptionCode="NoSuchCoverage"/></ows:ExceptionReport>',
      { status: 400, headers: { 'content-type': 'application/xml' } },
    )) as typeof fetch;

    try {
      const response = await request(rasterMapPath());
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: 'empty', values: [], grid: null, metadata: { unit: '°C' } });
    } finally {
      globalThis.fetch = originalFetch;
    }
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
        run: { defaultOnly: true },
        scenario: { name: 'CurrentPolicies' },
        region: { name_in: ['Austria'] },
      });
      expect(query).not.toHaveProperty('stepYear');
      expect(query).not.toHaveProperty('model');
    }
  });
});

test('loads regions across Europe for the all-country map', async () => {
  const response = await request(mapPath({ region: 'all' }));
  expect(response.status).toBe(200);
  const regions = tabulate.mock.calls[0][0].region.name_in;
  expect(regions).toContain('AT11');
  expect(regions).toContain('FR10');
  expect((await response.json()).values).toContainEqual({ region: 'AT11', value: 0 });
});
