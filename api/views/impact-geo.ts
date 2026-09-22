import { REPRESENTATIVE_VALUE } from '../conventions';

export interface ImpactGeoSelection {
  indicator: string;
  geography: string;
  reference: string;
  time: string;
  spatial: string;
}

export interface GeoServerConfig {
  url: string;
  workspace: string;
  username?: string;
  password?: string;
}

export interface ImpactGeoParams extends ImpactGeoSelection {
  scenario: string;
  year: number;
}

export type ImpactGeoDownloadFormat = 'netcdf' | 'geotiff';

export class ImpactGeoCoverageNotFoundError extends Error {}
export class ImpactGeoUpstreamError extends Error {}
export class ImpactGeoConfigurationError extends Error {}

const WCS_TIMEOUT_MS = 15_000;

export function coverageIdSegment(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function coverageFamily(selection: ImpactGeoSelection, scenario: string): string {
  const variable = `${selection.indicator} ${selection.reference}`;
  return [scenario, selection.geography, variable, selection.time,
    selection.spatial, REPRESENTATIVE_VALUE].map(coverageIdSegment).join('_');
}

export function coverageId(params: ImpactGeoParams): string {
  return `${coverageFamily(params, params.scenario)}_${params.year}`;
}

function advertisedCoverageIds(xml: string): string[] {
  const ids: string[] = [];
  const elements = xml.matchAll(/<(?:[\w.-]+:)?(?:name|CoverageId)>([^<]+)<\/(?:[\w.-]+:)?(?:name|CoverageId)>/gi);
  for (const element of elements) ids.push(element[1].trim());
  return ids;
}

export function availableYearsByScenario(xml: string, selection: ImpactGeoSelection, scenarios: string[], workspace: string): Record<string, number[]> {
  const published = advertisedCoverageIds(xml);
  const escapedWorkspace = workspace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Object.fromEntries(scenarios.map((scenario) => {
    const family = coverageFamily(selection, scenario);
    const escaped = family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapedWorkspace}(?::|__)${escaped}_(\\d{4})$`);
    const years = new Set<number>();
    for (const id of published) {
      const year = id.match(pattern)?.[1];
      if (year) years.add(Number(year));
    }
    return [scenario, [...years].sort((a, b) => a - b)];
  }));
}

function wcsUrl(config: GeoServerConfig): URL {
  return new URL(`${config.url.replace(/\/$/, '')}/${encodeURIComponent(config.workspace)}/wcs`);
}

export function buildGetCoverageUrl(config: GeoServerConfig, id: string, format: ImpactGeoDownloadFormat = 'geotiff'): URL {
  const url = wcsUrl(config);
  let outputFormat = 'image/tiff';
  if (format === 'netcdf') outputFormat = 'application/x-netcdf';
  url.search = new URLSearchParams({
    service: 'WCS', version: '2.0.1', request: 'GetCoverage', coverageId: `${config.workspace}__${id}`,
    format: outputFormat, outputCrs: 'http://www.opengis.net/def/crs/EPSG/0/4326',
  }).toString();
  return url;
}

function buildCapabilitiesUrl(config: GeoServerConfig): URL {
  const url = wcsUrl(config);
  // GeoServer 2.28 WCS 2 capabilities can omit valid NetCDF layers; WCS 1 lists them all.
  url.search = new URLSearchParams({ service: 'WCS', version: '1.0.0', request: 'GetCapabilities' }).toString();
  return url;
}

async function boundedFetch(url: URL, config: GeoServerConfig, fetcher: typeof fetch): Promise<Response> {
  if (Boolean(config.username) !== Boolean(config.password)) {
    throw new ImpactGeoConfigurationError('GeoServer username and password must be configured together');
  }
  const headers = new Headers();
  if (config.username !== undefined && config.password !== undefined) {
    headers.set('authorization', `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`);
  }
  try {
    return await fetcher(url, { headers, signal: AbortSignal.timeout(WCS_TIMEOUT_MS) });
  } catch {
    throw new ImpactGeoUpstreamError('GeoServer WCS request failed');
  }
}

export async function fetchImpactGeoAvailability(
  config: GeoServerConfig, selection: ImpactGeoSelection, scenarios: string[], fetcher: typeof fetch = fetch,
): Promise<Record<string, number[]>> {
  const response = await boundedFetch(buildCapabilitiesUrl(config), config, fetcher);
  if (!response.ok) throw new ImpactGeoUpstreamError(`GeoServer capabilities failed with HTTP ${response.status}`);
  const body = await response.text();
  if (/<(?:[\w.-]+:)?(?:ExceptionReport|ServiceExceptionReport)\b/i.test(body)) {
    throw new ImpactGeoUpstreamError('GeoServer returned a WCS exception for capabilities');
  }
  if (!/<(?:[\w.-]+:)?WCS_Capabilities\b/i.test(body)) {
    throw new ImpactGeoUpstreamError('GeoServer returned malformed WCS capabilities');
  }
  return availableYearsByScenario(body, selection, scenarios, config.workspace);
}

function wcsExceptionCode(body: string): string | undefined {
  return body.match(/<(?:[\w.-]+:)?Exception\b[^>]*(?:exceptionCode|code)=["']([^"']+)["']/i)?.[1]
    ?? body.match(/<(?:[\w.-]+:)?ServiceException\b[^>]*code=["']([^"']+)["']/i)?.[1];
}

function isMissingCoverageCode(code?: string): boolean {
  return code === 'NoSuchCoverage' || code === 'CoverageNotDefined';
}

export async function fetchImpactGeoRaster(
  config: GeoServerConfig, params: ImpactGeoParams, fetcher: typeof fetch = fetch,
): Promise<Response> {
  return fetchImpactGeoCoverage(config, params, 'geotiff', fetcher);
}

async function fetchImpactGeoCoverage(
  config: GeoServerConfig, params: ImpactGeoParams, format: ImpactGeoDownloadFormat, fetcher: typeof fetch,
): Promise<Response> {
  const id = coverageId(params);
  const response = await boundedFetch(buildGetCoverageUrl(config, id, format), config, fetcher);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  let isExpectedFormat = contentType.includes('image/tiff') || contentType.includes('application/octet-stream');
  if (format === 'netcdf') isExpectedFormat = contentType.includes('application/x-netcdf');
  if (!isExpectedFormat) {
    const body = await response.text();
    const exceptionCode = wcsExceptionCode(body);
    if (isMissingCoverageCode(exceptionCode)) {
      throw new ImpactGeoCoverageNotFoundError(`GeoServer has no coverage for ${id}`);
    }
    if (exceptionCode || /ExceptionReport|ServiceException/i.test(body)) {
      throw new ImpactGeoUpstreamError(`GeoServer WCS exception${exceptionCode ? `: ${exceptionCode}` : ''}`);
    }
    if (!response.ok) throw new ImpactGeoUpstreamError(`GeoServer WCS request failed with HTTP ${response.status}`);
    throw new ImpactGeoUpstreamError(`GeoServer returned an invalid ${format} WCS response`);
  }
  if (!response.ok) throw new ImpactGeoUpstreamError(`GeoServer WCS request failed with HTTP ${response.status}`);
  return response;
}

export async function fetchImpactGeoDownload(
  config: GeoServerConfig, params: ImpactGeoParams, format: ImpactGeoDownloadFormat,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  return fetchImpactGeoCoverage(config, params, format, fetcher);
}
