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
  timeoutMs?: number;
}

export interface ImpactGeoParams extends ImpactGeoSelection {
  scenario: string;
  year: number;
}

export type ImpactGeoDownloadFormat = 'netcdf' | 'geotiff';

export class ImpactGeoCoverageNotFoundError extends Error {}
export class ImpactGeoUpstreamError extends Error {
  readonly code: string;
  readonly upstreamStatus?: number;
  readonly timeoutMs?: number;

  constructor(message: string, details: { code?: string; upstreamStatus?: number; timeoutMs?: number } = {}) {
    super(message);
    this.code = details.code ?? 'GEOSERVER_UPSTREAM_ERROR';
    this.upstreamStatus = details.upstreamStatus;
    this.timeoutMs = details.timeoutMs;
  }
}
export class ImpactGeoConfigurationError extends Error {}

const WCS_TIMEOUT_MS = 30_000;

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

async function boundedRequest<T>(url: URL, config: GeoServerConfig, fetcher: typeof fetch, callerSignal: AbortSignal | undefined, consume: (response: Response) => Promise<T>): Promise<T> {
  if (Boolean(config.username) !== Boolean(config.password)) {
    throw new ImpactGeoConfigurationError('GeoServer username and password must be configured together');
  }
  const headers = new Headers();
  if (config.username !== undefined && config.password !== undefined) {
    headers.set('authorization', `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`);
  }
  const timeoutMs = config.timeoutMs ?? WCS_TIMEOUT_MS;
  const controller = new AbortController();
  const signal = callerSignal ? AbortSignal.any([callerSignal, controller.signal]) : controller.signal;
  signal.throwIfAborted();
  let timer: ReturnType<typeof setTimeout>;
  let onAbort: () => void;
  let response: Response | undefined;
  const cancellation = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      const error = new ImpactGeoUpstreamError(`GeoServer did not respond within ${timeoutMs / 1000} seconds. Please try again.`, {
        code: 'GEOSERVER_TIMEOUT', timeoutMs,
      });
      controller.abort(error);
    }, timeoutMs);
  });
  try {
    const request = (async () => {
      response = await fetcher(url, { headers, signal });
      if (signal.aborted) {
        void response.body?.cancel().catch(() => {});
        throw signal.reason;
      }
      return consume(response);
    })();
    return await Promise.race([request, cancellation]);
  } catch (error) {
    void response?.body?.cancel().catch(() => {});
    callerSignal?.throwIfAborted();
    if (error instanceof ImpactGeoUpstreamError || error instanceof ImpactGeoCoverageNotFoundError) throw error;
    const message = response ? 'Could not read the GeoServer response.' : 'Could not connect to GeoServer.';
    throw new ImpactGeoUpstreamError(message, { code: 'GEOSERVER_NETWORK_ERROR', upstreamStatus: response?.status });
  } finally {
    clearTimeout(timer!);
    signal.removeEventListener('abort', onAbort!);
  }
}

function wcsExceptionCode(body: string): string | undefined {
  return body.match(/<(?:[\w.-]+:)?Exception\b[^>]*(?:exceptionCode|code)=["']([^"']+)["']/i)?.[1]
    ?? body.match(/<(?:[\w.-]+:)?ServiceException\b[^>]*code=["']([^"']+)["']/i)?.[1];
}

function isMissingCoverageCode(code?: string): boolean {
  return code === 'NoSuchCoverage' || code === 'CoverageNotDefined';
}

export async function fetchImpactGeoRaster(
  config: GeoServerConfig, params: ImpactGeoParams, fetcher: typeof fetch = fetch, signal?: AbortSignal,
): Promise<Response> {
  return fetchImpactGeoCoverage(config, params, 'geotiff', fetcher, signal);
}

async function fetchImpactGeoCoverage(
  config: GeoServerConfig, params: ImpactGeoParams, format: ImpactGeoDownloadFormat, fetcher: typeof fetch, signal?: AbortSignal,
): Promise<Response> {
  const id = coverageId(params);
  return boundedRequest(buildGetCoverageUrl(config, id, format), config, fetcher, signal, async (response) => {
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
        throw new ImpactGeoUpstreamError('GeoServer returned a WCS exception for the map', { code: 'GEOSERVER_WCS_ERROR' });
      }
      if (!response.ok) throw new ImpactGeoUpstreamError(`GeoServer WCS request failed with HTTP ${response.status}`, {
        code: 'GEOSERVER_HTTP_ERROR', upstreamStatus: response.status,
      });
      throw new ImpactGeoUpstreamError(`GeoServer returned an invalid ${format} WCS response`, { code: 'GEOSERVER_INVALID_RESPONSE' });
    }
    if (!response.ok) throw new ImpactGeoUpstreamError(`GeoServer WCS request failed with HTTP ${response.status}`, {
      code: 'GEOSERVER_HTTP_ERROR', upstreamStatus: response.status,
    });
    return response;
  });
}

export async function fetchImpactGeoDownload(
  config: GeoServerConfig, params: ImpactGeoParams, format: ImpactGeoDownloadFormat,
  fetcher: typeof fetch = fetch, signal?: AbortSignal,
): Promise<Response> {
  return fetchImpactGeoCoverage(config, params, format, fetcher, signal);
}
