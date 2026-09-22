import { describe, expect, test } from 'bun:test';
import { writeArrayBuffer } from 'geotiff';
import {
  availableYearsByScenario,
  buildGetCoverageUrl,
  coverageId,
  coverageIdSegment,
  fetchImpactGeoDownload,
  fetchImpactGeoAvailability,
  fetchImpactGeoRaster,
  ImpactGeoCoverageNotFoundError,
  ImpactGeoUpstreamError,
  type ImpactGeoParams,
  type GeoServerConfig,
} from './impact-geo';

const geoserver: GeoServerConfig = { url: 'http://geo.test/geoserver', workspace: 'climate-risk-dashboard', username: 'map-reader', password: 'secret' };
const localGeoserver: GeoServerConfig = { ...geoserver, workspace: 'provide' };

const params: ImpactGeoParams = {
  indicator: 'Mean Temperature',
  geography: 'Cameroon',
  reference: '2011-2020 (Present Day)',
  time: 'Annual',
  spatial: 'Area',
  scenario: '2020 Climate Policies',
  year: 2030,
};

const expectedId =
  '2020-climate-policies_cameroon_mean-temperature-2011-2020-present-day_annual_area_50th-percentile_2030';

test('builds exact convention coverage ids and WCS 2 raster requests', () => {
  expect(coverageIdSegment('Stabilisation at 1.5 °C')).toBe('stabilisation-at-1-5-c');
  expect(coverageId(params)).toBe(expectedId);
  const request = buildGetCoverageUrl(geoserver, expectedId);
  expect(request.pathname).toBe('/geoserver/climate-risk-dashboard/wcs');
  expect(Object.fromEntries(request.searchParams)).toEqual({
    service: 'WCS',
    version: '2.0.1',
    request: 'GetCoverage',
    coverageId: `climate-risk-dashboard__${expectedId}`,
    format: 'image/tiff',
    outputCrs: 'http://www.opengis.net/def/crs/EPSG/0/4326',
  });
});

test('matches exact workspace coverage families and sorts years per scenario', () => {
  const other = expectedId.replace('2020-climate-policies', 'low-demand');
  const xml = `<name>provide:${expectedId.replace('2030', '2050')}</name>
    <name>provide:${expectedId}</name><name>other:${expectedId.replace('2030', '2100')}</name>
    <name>provide:${expectedId.replace('mean-temperature', 'mean-temperature-extra').replace('2030', '2100')}</name>
    <CoverageId>provide__${other}</CoverageId>`;
  expect(availableYearsByScenario(xml, params, ['2020 Climate Policies', 'Low Demand', 'Missing'], 'provide')).toEqual({
    '2020 Climate Policies': [2030, 2050],
    'Low Demand': [2030],
    Missing: [],
  });
});

test('matches convention coverage years in the configured workspace', () => {
  const lowDemand2050 = expectedId.replace('2020-climate-policies', 'low-demand').replace('2030', '2050');
  const xml = `<WCS_Capabilities><name>climate-risk-dashboard:${expectedId}</name>
    <name>climate-risk-dashboard:${lowDemand2050}</name>
    <name>other:${expectedId.replace('2030', '2100')}</name></WCS_Capabilities>`;
  expect(availableYearsByScenario(xml, params, ['2020 Climate Policies', 'Low Demand'], 'climate-risk-dashboard')).toEqual({
    '2020 Climate Policies': [2030],
    'Low Demand': [2050],
  });
});

test('reads capabilities once for every requested scenario', async () => {
  let calls = 0;
  const fetcher = (async () => {
    calls += 1;
    return new Response(`<WCS_Capabilities><name>provide:${expectedId}</name></WCS_Capabilities>`);
  }) as typeof fetch;
  const result = await fetchImpactGeoAvailability(localGeoserver, params, ['2020 Climate Policies', 'Low Demand'], fetcher);
  expect(calls).toBe(1);
  expect(result).toEqual({ '2020 Climate Policies': [2030], 'Low Demand': [] });
});

test('authenticates WCS requests without putting credentials in their URL', async () => {
  let input: RequestInfo | URL | undefined;
  let init: RequestInit | undefined;
  const fetcher = (async (nextInput: RequestInfo | URL, nextInit?: RequestInit) => {
    input = nextInput;
    init = nextInit;
    return new Response(`<WCS_Capabilities><name>climate-risk-dashboard:${expectedId}</name></WCS_Capabilities>`);
  }) as typeof fetch;
  await fetchImpactGeoAvailability(geoserver, params, ['2020 Climate Policies'], fetcher);
  expect(String(input)).not.toContain('map-reader');
  expect(new Headers(init?.headers).get('authorization')).toBe(`Basic ${btoa('map-reader:secret')}`);
});

test('supports anonymous GeoServer requests when both credentials are absent', async () => {
  let init: RequestInit | undefined;
  const fetcher = (async (_input: RequestInfo | URL, nextInit?: RequestInit) => {
    init = nextInit;
    return new Response(`<WCS_Capabilities><name>provide:${expectedId}</name></WCS_Capabilities>`);
  }) as typeof fetch;
  await fetchImpactGeoAvailability({ url: geoserver.url, workspace: 'provide' }, params, ['2020 Climate Policies'], fetcher);
  expect(new Headers(init?.headers).has('authorization')).toBe(false);
});

test('rejects partial credentials before sending a GeoServer request', async () => {
  const fetcher = (() => Promise.resolve(new Response('unused'))) as typeof fetch;
  const tracked = Object.assign(fetcher, { calls: 0 });
  const countFetch = (async (...args: Parameters<typeof fetch>) => {
    tracked.calls += 1;
    return tracked(...args);
  }) as typeof fetch;
  await expect(fetchImpactGeoAvailability({ ...geoserver, password: undefined }, params, ['2020 Climate Policies'], countFetch))
    .rejects.toThrow('GeoServer username and password must be configured together');
  expect(tracked.calls).toBe(0);
});

test('treats failed authentication as an upstream error rather than empty availability', async () => {
  const unauthorized = (() => Promise.resolve(new Response('Unauthorized', { status: 401 }))) as typeof fetch;
  await expect(fetchImpactGeoAvailability(geoserver, params, ['2020 Climate Policies'], unauthorized))
    .rejects.toBeInstanceOf(ImpactGeoUpstreamError);
});

test('rejects WCS exceptions and malformed capabilities instead of reporting empty availability', async () => {
  for (const body of [
    '<ows:ExceptionReport><ows:Exception exceptionCode="NoApplicableCode"/></ows:ExceptionReport>',
    '<html>proxy error</html>',
  ]) {
    const fetcher = (() => Promise.resolve(new Response(body, { status: 200 }))) as typeof fetch;
    await expect(fetchImpactGeoAvailability(geoserver, params, ['Low Demand'], fetcher))
      .rejects.toBeInstanceOf(ImpactGeoUpstreamError);
  }
});

describe('WCS raster boundary', () => {
  const tiff = writeArrayBuffer(new Float32Array([3, -9999, 1, 2]), {
    width: 2,
    height: 2,
    ModelPixelScale: [2, 2, 0],
    ModelTiepoint: [0, 0, 0, 10, 24, 0],
    GeographicTypeGeoKey: 4326,
    GTModelTypeGeoKey: 2,
    GTRasterTypeGeoKey: 1,
    GDAL_NODATA: '-9999',
  });

  test('returns the same raster response for download without capabilities', async () => {
    let calls = 0;
    let init: RequestInit | undefined;
    const fetcher = (async (_input: RequestInfo | URL, nextInit?: RequestInit) => {
      calls += 1;
      init = nextInit;
      return new Response(tiff, { headers: { 'content-type': 'image/tiff' } });
    }) as typeof fetch;
    const response = await fetchImpactGeoRaster(localGeoserver, params, fetcher);
    expect(calls).toBe(1);
    expect(new Headers(init?.headers).get('authorization')).toBe(`Basic ${btoa('map-reader:secret')}`);
    expect(await response.arrayBuffer()).toEqual(tiff);
  });

  test('requests convention coverage ids across scenarios, years, and download formats', async () => {
    const requested: URL[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requested.push(url);
      const contentType = url.searchParams.get('format') ?? 'application/octet-stream';
      return new Response(new Uint8Array([1]), { headers: { 'content-type': contentType } });
    }) as typeof fetch;
    const lowDemand2050 = { ...params, scenario: 'Low Demand', year: 2050 };
    const lowDemandId = expectedId.replace('2020-climate-policies', 'low-demand').replace('2030', '2050');
    await fetchImpactGeoDownload(geoserver, params, 'netcdf', fetcher);
    await fetchImpactGeoDownload(geoserver, lowDemand2050, 'geotiff', fetcher);
    expect(requested.map((url) => url.searchParams.get('format'))).toEqual(['application/x-netcdf', 'image/tiff']);
    expect(requested[0].searchParams.get('coverageId')).toBe(`climate-risk-dashboard__${expectedId}`);
    expect(requested[1].searchParams.get('coverageId')).toBe(`climate-risk-dashboard__${lowDemandId}`);
  });

  test('recognises only missing-coverage exceptions as absence', async () => {
    const missingBody = '<ows:ExceptionReport><ows:Exception exceptionCode="NoSuchCoverage"/></ows:ExceptionReport>';
    const missing = (() => Promise.resolve(new Response(missingBody, { status: 400, headers: { 'content-type': 'application/xml' } }))) as typeof fetch;
    await expect(fetchImpactGeoRaster(localGeoserver, params, missing)).rejects.toBeInstanceOf(ImpactGeoCoverageNotFoundError);
  });

  test('treats other WCS exceptions as upstream failures regardless of HTTP status', async () => {
    for (const status of [200, 400]) {
      const body = '<ows:ExceptionReport><ows:Exception exceptionCode="NoApplicableCode"/></ows:ExceptionReport>';
      const failed = (() => Promise.resolve(new Response(body, { status, headers: { 'content-type': 'application/xml' } }))) as typeof fetch;
      await expect(fetchImpactGeoRaster(localGeoserver, params, failed)).rejects.toBeInstanceOf(ImpactGeoUpstreamError);
    }
  });

});
