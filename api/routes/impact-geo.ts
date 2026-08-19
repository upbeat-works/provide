import { Hono } from 'hono';
import type { Env } from '../types';
import { FACET_DEFAULTS } from '../conventions';
import { fetchImpactGeo, ImpactGeoCoverageNotFoundError, type ImpactGeoParams } from '../views/impact-geo';

const impactGeo = new Hono<Env>();

impactGeo.get('/', async (c) => {
  const indicator = c.req.query('indicator');
  const scenario = c.req.query('scenario');
  const geography = c.req.query('geography');
  const rawYear = c.req.query('year');
  const year = Number(rawYear);

  if (!indicator || !scenario || !geography || !rawYear || !Number.isInteger(year)) {
    return c.json({ error: 'Missing required params: indicator, scenario, geography, year' }, 400);
  }

  const params: ImpactGeoParams = {
    indicator,
    scenario,
    geography,
    year,
    time: c.req.query('time') ?? FACET_DEFAULTS.temporal,
    reference: c.req.query('reference') ?? FACET_DEFAULTS.period,
    spatial: c.req.query('spatial') ?? FACET_DEFAULTS.spatial,
    frequency: c.req.query('frequency') ?? '0.5',
  };

  const geoserverUrl = c.env.GEOSERVER_URL;
  if (!geoserverUrl) {
    return c.json({ error: 'GEOSERVER_URL is not configured' }, 503);
  }

  try {
    return c.json(await fetchImpactGeo(geoserverUrl, params));
  } catch (error) {
    if (error instanceof ImpactGeoCoverageNotFoundError) {
      return c.json({ message: error.message, isExpected: true }, 404);
    }
    const message = error instanceof Error ? error.message : 'GeoServer request failed';
    return c.json({ error: message }, 502);
  }
});

export { impactGeo };
