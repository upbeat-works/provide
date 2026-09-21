// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { writeArrayBuffer } from 'geotiff';
import { loadImpactGeoGrid, processMapRequests } from './impact-geo-grid.js';
import { calculateDifference } from '../utils/geo.js';

const params = { indicator: 'Mean Temperature', geography: 'Cameroon', reference: 'Present', time: 'Annual', spatial: 'Area', scenario: 'Low Demand', year: 2050 };

function raster(values = [3, -9999, 1, 2], scale = [2, 2, 0]) {
  return writeArrayBuffer(new Float32Array(values), {
    width: 2, height: 2, ModelPixelScale: scale, ModelTiepoint: [0, 0, 0, 10, 24, 0],
    GeographicTypeGeoKey: 4326, GTModelTypeGeoKey: 2, GTRasterTypeGeoKey: 1, GDAL_NODATA: '-9999',
  });
}

const response = (values, scale) => new Response(raster(values, scale), { headers: { 'content-type': 'image/tiff' } });
afterEach(() => vi.unstubAllGlobals());

test('decodes a north-up raster into the grid used by map rendering and downloads', async () => {
  const grid = await loadImpactGeoGrid('https://app.test/api/impact-geo/', params, async () => response());
  expect(grid).toMatchObject({
    coordinatesOrigin: [11, 21], resolution: 2, resolutions: [2], data: [[1, 3], [2, null]],
    year: 2050, formats: ['netcdf', 'geotiff'], parameters: { indicator: params.indicator, scenario: params.scenario, frequency: 0.5 },
  });
});

test('preserves cell values and missing cells when comparing decoded scenarios', async () => {
  const first = await loadImpactGeoGrid('https://app.test/first', params, async () => response());
  const second = await loadImpactGeoGrid('https://app.test/second', params, async () => response([5, 4, -9999, 7]));
  expect(calculateDifference([{ data: first }, { data: second }]).data).toEqual([[null, 2], [5, null]]);
});

test('rejects a raster whose cells do not match the map grid geometry', async () => {
  await expect(loadImpactGeoGrid('https://app.test/map', params, async () => response(undefined, [2, 1, 0])))
    .rejects.toThrow('non-square');
});

test.each([
  [Response.json({ message: 'No map for this year', isExpected: true }, { status: 404 }), 'No map for this year'],
  [Response.json({ error: 'GeoServer unavailable' }, { status: 502 }), 'GeoServer unavailable'],
  [new Response('broken TIFF', { headers: { 'content-type': 'image/tiff' } }), undefined],
])('reports map response failures', async (failedResponse, message) => {
  const request = loadImpactGeoGrid('https://app.test/map', params, async () => failedResponse);
  if (message) {
    await expect(request).rejects.toThrow(message);
    return;
  }
  await expect(request).rejects.toBeInstanceOf(Error);
});

test('stops comparison downloads when a scenario fails', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({ error: 'GeoServer unavailable' }, { status: 502 }),
  );
  vi.stubGlobal('fetch', fetcher);
  const results = [];
  const requests = ['first', 'second'].map((scenario) => ({
    url: `https://app.test/${scenario}`,
    params: { ...params, scenario },
  }));
  await processMapRequests(requests, (result) => results.push(result));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(results).toEqual([{
    index: 0,
    result: { status: 'failed', message: 'GeoServer unavailable', isExpected: false },
  }]);
});
