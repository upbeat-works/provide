import { describe, expect, test } from 'bun:test';
import { writeArrayBuffer } from 'geotiff';
import {
  buildWcsUrl,
  coverageIdSegment,
  fetchImpactGeo,
  rasterGridToImpactGeo,
  resolveImpactGeoCoverage,
  selectableYearsFromCapabilities,
  type ImpactGeoCoverage,
  type ImpactGeoParams,
} from './impact-geo';

const parameters: ImpactGeoParams = {
  indicator: 'Mean Temperature',
  scenario: '2020 Climate Policies',
  geography: 'Cameroon',
  year: 2030,
  time: 'Annual',
  reference: '2011-2020 (Present Day)',
  spatial: 'Area',
  frequency: '0.5',
};

const coverage: ImpactGeoCoverage = {
  id: 'mean-temperature__2011-2020-present-day__annual__area__50th-percentile__2020-climate-policies__cameroon__2030',
  parameters,
  model: 'MESMER (Beusch et al., 2020, 2022)',
  source: 'Schwaab et al., in prep.',
  title: 'Changes in Mean Temperature in Cameroon in 2030',
  description:
    'This map shows the change in Mean Temperature in Cameroon in 2030, relative to 2011-2020 (Present Day), for 2020 Climate Policies.',
  selectableYears: [],
};

describe('resolveImpactGeoCoverage', () => {
  test('derives the NetCDF coverage from convention-native values', () => {
    expect(resolveImpactGeoCoverage(parameters)).toMatchObject({
      id: coverage.id,
      parameters,
      selectableYears: [],
    });
  });

  test('derives an unregistered scenario coverage instead of consulting a scenario table', () => {
    expect(resolveImpactGeoCoverage({ ...parameters, scenario: 'A New Scenario 2.0' })?.id).toBe(
      'mean-temperature__2011-2020-present-day__annual__area__50th-percentile__a-new-scenario-2-0__cameroon__2030',
    );
  });

  test('normalises punctuation and unicode convention values consistently', () => {
    expect(coverageIdSegment('SSP5-3.4-Overshoot')).toBe('ssp5-3-4-overshoot');
    expect(coverageIdSegment('Stabilisation at 1.5 °C')).toBe('stabilisation-at-1-5-c');
  });

  test('discovers available years from convention-derived coverage names', () => {
    const xml = `
      <CoverageOfferingBrief><name>provide:${coverage.id}</name></CoverageOfferingBrief>
      <CoverageOfferingBrief><name>provide:${coverage.id.replace('2030', '2050')}</name></CoverageOfferingBrief>
      <CoverageOfferingBrief><name>provide:some-other-coverage__2100</name></CoverageOfferingBrief>
      <CoverageOfferingBrief><name>provide:${coverage.id.replace('2030', '2100')}</name></CoverageOfferingBrief>
    `;
    expect(selectableYearsFromCapabilities(xml, coverage.id)).toEqual(['2030', '2050', '2100']);
  });
});

test('builds a WCS 2 request for the published NetCDF coverage', () => {
  const url = buildWcsUrl('http://geoserver:8080/geoserver', coverage);

  expect(url.pathname).toBe('/geoserver/provide/wcs');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    service: 'WCS',
    version: '2.0.1',
    request: 'GetCoverage',
    coverageId: `provide__${coverage.id}`,
    format: 'image/tiff',
    outputCrs: 'http://www.opengis.net/def/crs/EPSG/0/4326',
  });
});

test('converts north-up raster rows into the frontend longitude/latitude grid', () => {
  const result = rasterGridToImpactGeo(
    {
      width: 2,
      height: 2,
      boundingBox: [10, 20, 14, 24],
      values: new Float32Array([3, Number.NaN, 1, 2]),
    },
    coverage,
  );

  expect(result.coordinatesOrigin).toEqual([11, 21]);
  expect(result.resolution).toBe(2);
  expect(result.data).toEqual([
    [1, 3],
    [2, null],
  ]);
  expect(result.parameters).toEqual({
    indicator: parameters.indicator,
    scenario: parameters.scenario,
    geography: parameters.geography,
    time: parameters.time,
    frequency: 0.5,
    reference: parameters.reference,
    spatial: parameters.spatial,
  });
  expect(result.formats).toEqual(['netcdf', 'geotiff']);
});

test('decodes the GeoTIFF returned by the WCS boundary', async () => {
  const tiff = writeArrayBuffer(new Float32Array([3, 4, 1, 2]), {
    width: 2,
    height: 2,
    ModelPixelScale: [2, 2, 0],
    ModelTiepoint: [0, 0, 0, 10, 24, 0],
    GeographicTypeGeoKey: 4326,
    GTModelTypeGeoKey: 2,
    GTRasterTypeGeoKey: 1,
  });
  const requested: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    if (url.includes('GetCapabilities')) {
      return new Response(`<CoverageOfferingBrief><name>provide:${coverage.id}</name></CoverageOfferingBrief>`);
    }
    return new Response(tiff);
  }) as typeof fetch;

  const result = await fetchImpactGeo('http://geoserver:8080/geoserver', parameters, fetcher);

  expect(requested.some((url) => url.includes(`coverageId=provide__${coverage.id}`))).toBe(true);
  expect(result.coordinatesOrigin).toEqual([11, 21]);
  expect(result.data).toEqual([
    [1, 3],
    [2, 4],
  ]);
  expect(result.selectableYears).toEqual(['2030']);
});
