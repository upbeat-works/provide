import { Hono, type Context } from 'hono';
import { instances } from '../instances';
import type { Env } from '../types';
import {
  coverageIdSegment,
  fetchImpactGeoAvailability,
  fetchImpactGeoDownload,
  fetchImpactGeoRaster,
  ImpactGeoCoverageNotFoundError,
  ImpactGeoConfigurationError,
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

function errorResponse(c: Context<Env>, error: unknown) {
  if (error instanceof ImpactGeoConfigurationError) {
    return c.json({ error: error.message }, 503);
  }
  if (error instanceof ImpactGeoCoverageNotFoundError) {
    return c.json({ message: error.message, isExpected: true }, 404);
  }
  const message = error instanceof Error ? error.message : 'GeoServer request failed';
  return c.json({ error: message }, 502);
}

function geoServerConfig(c: Context<Env>): GeoServerConfig | Response {
  if (!c.env.GEOSERVER_URL) return c.json({ error: 'GEOSERVER_URL is not configured' }, 503);
  const username = c.env.GEOSERVER_USERNAME || undefined;
  const password = c.env.GEOSERVER_PASSWORD || undefined;
  if (Boolean(username) !== Boolean(password)) {
    return c.json({ error: 'GeoServer username and password must be configured together' }, 503);
  }
  return {
    url: c.env.GEOSERVER_URL,
    workspace: c.env.GEOSERVER_WORKSPACE || 'provide',
    username,
    password,
  };
}

impactGeo.get('/availability', async (c) => {
  const selected = selection(c);
  const scenarios = c.req.queries('scenarios') ?? [];
  const status = instanceStatus(c.req.query('instance'));
  if (!selected || scenarios.length === 0 || status === 'missing') {
    return c.json({ error: 'Missing required selection params, scenarios, or instance' }, 400);
  }
  if (status === 'unknown') return c.json({ error: `Unknown instance: ${c.req.query('instance')}` }, 404);
  const optionalError = invalidOptionalParams(c);
  if (optionalError) return c.json({ error: optionalError }, 400);
  if (status === 'unavailable') {
    return c.json({ scenarios: Object.fromEntries(scenarios.map((scenario) => [scenario, []])) });
  }
  const config = geoServerConfig(c);
  if (config instanceof Response) return config;
  try {
    return c.json({ scenarios: await fetchImpactGeoAvailability(config, selected, scenarios) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

impactGeo.get('/', async (c) => {
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
  const config = geoServerConfig(c);
  if (config instanceof Response) return config;
  const params: ImpactGeoParams = { ...selected, scenario, year };
  try {
    const format = c.req.query('format');
    if (format === 'geotiff' || format === 'netcdf') {
      const raster = await fetchImpactGeoDownload(config, params, format);
      const extension = format === 'netcdf' ? 'nc' : 'tif';
      const fallbackContentType = format === 'netcdf' ? 'application/x-netcdf' : 'image/tiff';
      const filename = `impact-geo_${coverageIdSegment(scenario)}_${year}.${extension}`;
      return new Response(raster.body, {
        status: 200,
        headers: {
          'content-type': raster.headers.get('content-type') ?? fallbackContentType,
          'content-disposition': `attachment; filename="${filename}"`,
        },
      });
    }
    const raster = await fetchImpactGeoRaster(config, params);
    return new Response(raster.body, {
      headers: { 'content-type': raster.headers.get('content-type') ?? 'image/tiff' },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { impactGeo };
