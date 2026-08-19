import { fromArrayBuffer } from 'geotiff';
import { REPRESENTATIVE_VALUE } from '../conventions';

export interface ImpactGeoParams {
  indicator: string;
  scenario: string;
  geography: string;
  year: number;
  time: string;
  reference: string;
  spatial: string;
  frequency: string;
}

export interface ImpactGeoCoverage {
  id: string;
  parameters: ImpactGeoParams;
  model: string;
  source: string;
  title: string;
  description: string;
  selectableYears: string[];
}

export interface RasterGrid {
  width: number;
  height: number;
  boundingBox: [number, number, number, number];
  values: ArrayLike<number>;
  noData?: number | null;
}

export interface ImpactGeoResponse {
  coordinatesOrigin: [number, number];
  resolution: number;
  resolutions: number[];
  formats: string[];
  data: Array<Array<number | null>>;
  parameters: {
    indicator: string;
    scenario: string;
    geography: string;
    time: string;
    frequency: number;
    reference: string;
    spatial: string;
  };
  selectableYears: string[];
  model: string;
  source: string;
  year: number;
  showDifference: false;
  title: string;
  description: string;
}

export function coverageIdSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function selectableYearsFromCapabilities(xml: string, coverageId: string): string[] {
  const yearSuffix = coverageId.match(/__(\d{4})$/);
  if (!yearSuffix) return [];
  const familyId = coverageId.slice(0, -yearSuffix[0].length);
  const escapedFamilyId = familyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const familyPattern = new RegExp(`^${escapedFamilyId}__(\\d{4})$`);
  const years = new Set<number>();
  const names = xml.matchAll(/<(?:[\w.-]+:)?(?:name|CoverageId)>([^<]+)<\/(?:[\w.-]+:)?(?:name|CoverageId)>/gi);

  for (const match of names) {
    const publishedName = match[1].trim();
    const familyOffset = publishedName.indexOf(familyId);
    if (familyOffset === -1) continue;
    const year = publishedName.slice(familyOffset).match(familyPattern)?.[1];
    if (year) years.add(Number(year));
  }

  return [...years].sort((a, b) => a - b).map(String);
}

export class ImpactGeoCoverageNotFoundError extends Error {}

export function resolveImpactGeoCoverage(params: ImpactGeoParams): ImpactGeoCoverage | null {
  const segments = [
    params.indicator,
    params.reference,
    params.time,
    params.spatial,
    REPRESENTATIVE_VALUE,
    params.scenario,
    params.geography,
  ].map(coverageIdSegment);
  if (segments.some((segment) => !segment) || !Number.isInteger(params.year)) return null;

  return {
    id: `${segments.join('__')}__${params.year}`,
    parameters: { ...params },
    model: 'MESMER (Beusch et al., 2020, 2022)',
    source: 'Schwaab et al., in prep.',
    title: `Changes in ${params.indicator} in ${params.geography} in ${params.year}`,
    description: `This map shows the change in ${params.indicator} in ${params.geography} in ${params.year}, relative to ${params.reference}, for ${params.scenario}.`,
    selectableYears: [],
  };
}

export function buildWcsUrl(geoserverUrl: string, coverage: ImpactGeoCoverage): URL {
  const url = new URL(`${geoserverUrl.replace(/\/$/, '')}/provide/wcs`);
  url.search = new URLSearchParams({
    service: 'WCS',
    version: '2.0.1',
    request: 'GetCoverage',
    coverageId: `provide__${coverage.id}`,
    format: 'image/tiff',
    outputCrs: 'http://www.opengis.net/def/crs/EPSG/0/4326',
  }).toString();
  return url;
}

function buildWcsCapabilitiesUrl(geoserverUrl: string): URL {
  const url = new URL(`${geoserverUrl.replace(/\/$/, '')}/provide/wcs`);
  url.search = new URLSearchParams({
    service: 'WCS',
    version: '1.0.0',
    request: 'GetCapabilities',
  }).toString();
  return url;
}

function isNoData(value: number, noData: number | null | undefined): boolean {
  return Number.isNaN(value) || (noData != null && (Number.isNaN(noData) ? Number.isNaN(value) : value === noData));
}

export function rasterGridToImpactGeo(raster: RasterGrid, coverage: ImpactGeoCoverage): ImpactGeoResponse {
  const [minX, minY, maxX, maxY] = raster.boundingBox;
  const resolutionX = (maxX - minX) / raster.width;
  const resolutionY = (maxY - minY) / raster.height;

  if (raster.values.length !== raster.width * raster.height) {
    throw new Error('GeoServer returned an unexpected raster size');
  }
  if (Math.abs(resolutionX - resolutionY) > 1e-9) {
    throw new Error('GeoServer returned non-square impact-geo cells');
  }

  const data = Array.from({ length: raster.width }, () =>
    Array.from<number | null>({ length: raster.height }).fill(null),
  );

  for (let row = 0; row < raster.height; row += 1) {
    const latitudeIndex = raster.height - row - 1;
    for (let column = 0; column < raster.width; column += 1) {
      const value = Number(raster.values[row * raster.width + column]);
      data[column][latitudeIndex] = isNoData(value, raster.noData) ? null : value;
    }
  }

  const { parameters } = coverage;
  return {
    coordinatesOrigin: [minX + resolutionX / 2, minY + resolutionY / 2],
    resolution: resolutionX,
    resolutions: [resolutionX],
    formats: ['netcdf', 'geotiff'],
    data,
    parameters: {
      indicator: parameters.indicator,
      scenario: parameters.scenario,
      geography: parameters.geography,
      time: parameters.time,
      frequency: Number(parameters.frequency),
      reference: parameters.reference,
      spatial: parameters.spatial,
    },
    selectableYears: coverage.selectableYears,
    model: coverage.model,
    source: coverage.source,
    year: parameters.year,
    showDifference: false,
    title: coverage.title,
    description: coverage.description,
  };
}

export async function fetchImpactGeo(
  geoserverUrl: string,
  params: ImpactGeoParams,
  fetcher: typeof fetch = fetch,
): Promise<ImpactGeoResponse> {
  const coverage = resolveImpactGeoCoverage(params);
  if (!coverage) throw new ImpactGeoCoverageNotFoundError('Invalid convention values for GeoServer coverage');

  const [response, capabilitiesResponse] = await Promise.all([
    fetcher(buildWcsUrl(geoserverUrl, coverage)),
    fetcher(buildWcsCapabilitiesUrl(geoserverUrl)),
  ]);
  if (!response.ok) {
    if (response.status === 400 || response.status === 404) {
      throw new ImpactGeoCoverageNotFoundError(`GeoServer has no coverage for ${coverage.id}`);
    }
    throw new Error(`GeoServer WCS request failed with HTTP ${response.status}`);
  }
  if (!capabilitiesResponse.ok) {
    throw new Error(`GeoServer WCS capabilities request failed with HTTP ${capabilitiesResponse.status}`);
  }

  const selectableYears = selectableYearsFromCapabilities(await capabilitiesResponse.text(), coverage.id);

  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const values = await image.readRasters({ interleave: true, samples: [0] });

  return rasterGridToImpactGeo(
    {
      width: image.getWidth(),
      height: image.getHeight(),
      boundingBox: image.getBoundingBox() as [number, number, number, number],
      values,
      noData: image.getGDALNoData(),
    },
    {
      ...coverage,
      selectableYears: selectableYears.length ? selectableYears : [String(params.year)],
    },
  );
}
