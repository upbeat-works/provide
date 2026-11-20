import { Hono, type Context } from 'hono';
import { instances } from '../instances';
import type { Env } from '../types';
import {
  coverageIdSegment,
  fetchImpactGeoDownload,
  fetchImpactGeoRaster,
  ImpactGeoCoverageNotFoundError,
  ImpactGeoConfigurationError,
  ImpactGeoUpstreamError,
  type ImpactGeoParams,
  type ImpactGeoSelection,
  type GeoServerConfig,
} from '../views/impact-geo';

const impactGeo = new Hono<Env>();
const MAP_INSTANCE = 'provide-internal';

function selection(c: Context<Env>): ImpactGeoSelection | null {
  const indicator = c.req.query('indicator');
  const geography = c.req.query('geography');
  const reference = c.req.query('reference');
  const time = c.req.query('time');
  const spatial = c.req.query('spatial');
  if (!indicator || !geography || !reference || !time || !spatial) return null;
  return { indicator, geography, reference, time, spatial };
}

function instanceStatus(instance: string | undefined): 'supported' | 'unavailable' | 'unknown' | 'missing' {
  if (!instance) return 'missing';
  if (!instances.some((entry) => entry.slug === instance)) return 'unknown';
  return instance === MAP_INSTANCE ? 'supported' : 'unavailable';
}

function invalidOptionalParams(c: Context<Env>): string | null {
  const format = c.req.query('format');
  if (format !== undefined && format !== 'geotiff' && format !== 'netcdf') return `Unsupported format: ${format}`;
  const resolution = c.req.query('resolution');
  if (resolution !== undefined && resolution !== 'native') return `Unsupported resolution: ${resolution}`;
  const frequency = c.req.query('frequency');
  if (frequency !== undefined && frequency !== '0.5') return `Unsupported frequency: ${frequency}`;
  const threshold = c.req.query('threshold');
  if (threshold !== undefined && threshold !== '50th Percentile') return `Unsupported threshold: ${threshold}`;
  const indicatorValue = c.req.query('indicator_value');
  if (indicatorValue !== undefined) return `Unsupported indicator_value: ${indicatorValue}`;
  return null;
}

function errorResponse(c: Context<Env>, error: unknown, started: number) {
  if (error instanceof ImpactGeoCoverageNotFoundError) {
    return c.json({ message: error.message, isExpected: true }, 404);
  }
  let status: 502 | 503 | 504 = 502;
  let code = 'GEOSERVER_UPSTREAM_ERROR';
  let message = 'GeoServer request failed. Please try again.';
  if (error instanceof ImpactGeoConfigurationError) {
    status = 503;
    code = 'GEOSERVER_CONFIGURATION_ERROR';
    message = error.message;
  }
  const upstream = error instanceof ImpactGeoUpstreamError ? error : undefined;
  if (upstream) {
    code = upstream.code;
    message = upstream.message;
    if (code === 'GEOSERVER_TIMEOUT') status = 504;
  }
  const requestId = crypto.randomUUID();
  let geoserverHost: string | undefined;
  try {
    geoserverHost = new URL(c.env.GEOSERVER_URL ?? '').hostname;
  } catch {}
  const details = { upstreamStatus: upstream?.upstreamStatus, timeoutMs: upstream?.timeoutMs };
  console.error(JSON.stringify({
    event: 'geoserver_request_failed', requestId, cfRay: c.req.header('cf-ray'),
    method: c.req.method, path: c.req.path,
    operation: 'GetCoverage',
    status, code, message, ...details, elapsedMs: Math.round(performance.now() - started),
    geoserverHost, workspace: c.env.GEOSERVER_WORKSPACE || 'provide',
    selection: { ...selection(c), scenario: c.req.query('scenario'), year: c.req.query('year'), format: c.req.query('format') },
  }));
  c.header('x-request-id', requestId);
  c.header('cache-control', 'no-store');
  return c.json({ error: message, code, requestId, ...details }, status);
}

function geoServerConfig(c: Context<Env>): GeoServerConfig {
  if (!c.env.GEOSERVER_URL) throw new ImpactGeoConfigurationError('GEOSERVER_URL is not configured');
  const username = c.env.GEOSERVER_USERNAME || undefined;
  const password = c.env.GEOSERVER_PASSWORD || undefined;
  if (Boolean(username) !== Boolean(password)) {
    throw new ImpactGeoConfigurationError('GeoServer username and password must be configured together');
  }
  return {
    url: c.env.GEOSERVER_URL,
    workspace: c.env.GEOSERVER_WORKSPACE || 'provide',
    username,
    password,
  };
}

impactGeo.get('/', async (c) => {
  const started = performance.now();
  const selected = selection(c);
  const scenario = c.req.query('scenario');
  const rawYear = c.req.query('year');
  const year = Number(rawYear);
  const status = instanceStatus(c.req.query('instance'));
  if (!selected || !scenario || !rawYear || !Number.isInteger(year) || status === 'missing') {
    return c.json({ error: 'Missing or invalid required selection params, scenario, year, or instance' }, 400);
  }
  if (status === 'unknown') return c.json({ error: `Unknown instance: ${c.req.query('instance')}` }, 404);
  if (status === 'unavailable') return c.json({ message: 'Map unavailable for this instance', isExpected: true }, 404);
  const optionalError = invalidOptionalParams(c);
  if (optionalError) return c.json({ error: optionalError }, 400);
  const params: ImpactGeoParams = { ...selected, scenario, year };
  try {
    const config = geoServerConfig(c);
    const format = c.req.query('format');
    if (format === 'geotiff' || format === 'netcdf') {
      const raster = await fetchImpactGeoDownload(config, params, format, fetch, c.req.raw.signal);
      const extension = format === 'netcdf' ? 'nc' : 'tif';
      const fallbackContentType = format === 'netcdf' ? 'application/x-netcdf' : 'image/tiff';
      const filename = `impact-geo_${coverageIdSegment(scenario)}_${year}.${extension}`;
      return new Response(raster.body, {
        status: 200,
        headers: {
          'content-type': raster.headers.get('content-type') ?? fallbackContentType,
          'cache-control': 'no-store',
          'content-disposition': `attachment; filename="${filename}"`,
        },
      });
    }
    const raster = await fetchImpactGeoRaster(config, params, fetch, c.req.raw.signal);
    return new Response(raster.body, {
      headers: { 'content-type': raster.headers.get('content-type') ?? 'image/tiff' },
    });
  } catch (error) {
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499, headers: { 'cache-control': 'no-store' } });
    return errorResponse(c, error, started);
  }
});

export { impactGeo };
