import { Hono, type Context } from 'hono';
import type { Env } from '../types';
import { instances } from '../instances';
import { createPlatform } from '../platform';
import { readScoreboardMapSeries } from '../views/scoreboard';
import { getScoreboard, SCOREBOARD_INSTANCE, SECTORS } from '../scoreboard/controller.js';
import { scoreboardCountry } from '../scoreboard/countries';
import { loadRegionalBoundaries, type NutsLevel } from '../scoreboard/boundaries';
import { regionalMapResult } from '../scoreboard/maps';
import { emptyRasterMapResult, rasterMapResult } from '../scoreboard/rasters';
import { definitionGroupingError, loadScoreboardChart } from '../scoreboard/charts';
import type { Definition, RasterMapIndicator, Selection } from '../scoreboard/types';
import {
  fetchImpactGeoRaster,
  ImpactGeoCoverageNotFoundError,
  type GeoServerConfig,
} from '../views/impact-geo';

const scoreboard = new Hono<Env>();

function source(c: Context<Env>) {
  const instance = instances.find(({ slug }) => slug === SCOREBOARD_INSTANCE);
  if (!instance) throw new Error('Scoreboard source unavailable');
  return createPlatform(instance, c.env.IXMP4_USERNAME, c.env.IXMP4_PASSWORD);
}

function selectionFromRequest(c: Context<Env>): Selection | null {
  const scenario = c.req.query('scenario');
  const region = c.req.query('region');
  const year = c.req.query('year');
  if (!scenario || !region || !year || !/^\d{4}$/.test(year)) return null;
  return { scenario, region, year: Number(year) };
}

function failure(c: Context<Env>, message: string, reason: unknown) {
  console.error(message, { path: c.req.path, sector: c.req.query('sector'), reasonName: reason instanceof Error ? reason.name : typeof reason });
  return c.json({ error: message }, 502);
}

function geoServerConfig(c: Context<Env>): GeoServerConfig | Response {
  if (!c.env.GEOSERVER_URL) return c.json({ error: 'GEOSERVER_URL is not configured' }, 503);
  const username = c.env.GEOSERVER_USERNAME || undefined;
  const password = c.env.GEOSERVER_PASSWORD || undefined;
  if (Boolean(username) !== Boolean(password)) {
    return c.json({ error: 'GeoServer username and password must be configured together' }, 503);
  }
  return { url: c.env.GEOSERVER_URL, workspace: c.env.GEOSERVER_WORKSPACE || 'provide', username, password };
}

function validRasterIndicator(indicator: RasterMapIndicator) {
  return [indicator.indicator, indicator.reference, indicator.time, indicator.spatial]
    .every((value) => typeof value === 'string' && value.trim().length > 0);
}

scoreboard.get('/charts/:chartId', async (c) => {
  const { charts } = getScoreboard(c.req.query('sector'));
  const definition = charts.find(({ chartId }) => chartId === c.req.param('chartId')) as Definition | undefined;
  if (!definition) return c.json({ error: 'Chart not found' }, 404);
  const selection = selectionFromRequest(c);
  if (!selection) return c.json({ error: 'scenario, region and a four-digit year are required' }, 400);
  const groupingError = definitionGroupingError(definition);
  if (groupingError) return c.json({ error: groupingError }, 400);
  try {
    return c.json(await loadScoreboardChart(await source(c), c.env.DB, definition, selection));
  } catch (reason) {
    return failure(c, 'Chart data unavailable', reason);
  }
});

scoreboard.get('/map', async (c) => {
  const sector = c.req.query('sector');
  const indicatorName = c.req.query('indicator');
  const scenario = c.req.query('scenario');
  const region = c.req.query('region');
  const yearText = c.req.query('year');
  if (!sector || !indicatorName || !scenario || !region || !yearText || !/^\d{4}$/.test(yearText)) {
    return c.json({ error: 'sector, indicator, scenario, region and a four-digit year are required' }, 400);
  }
  if (!SECTORS.some(({ uid }) => uid === sector)) return c.json({ error: 'Invalid scoreboard map selection' }, 400);
  const { map, indicator } = getScoreboard(sector, indicatorName);
  const country = scoreboardCountry(region);
  const year = Number(yearText);
  const validIndicator = map.indicators.some(({ name }) => name === indicatorName);
  const scenarioDefinition = map.scenarios.find(({ id }) => id === scenario);
  if (!validIndicator || !scenarioDefinition || !country || !map.years.includes(year)) {
    return c.json({ error: 'Invalid scoreboard map selection' }, 400);
  }
  if (indicator.type === 'raster') {
    if (!validRasterIndicator(indicator)) return c.json({ error: 'Invalid scoreboard map configuration' }, 400);
    const config = geoServerConfig(c);
    if (config instanceof Response) return config;
    try {
      const raster = await fetchImpactGeoRaster(config, {
        indicator: indicator.indicator,
        geography: country.name,
        reference: indicator.reference,
        time: indicator.time,
        spatial: indicator.spatial,
        scenario: scenarioDefinition.rasterName ?? scenario,
        year,
      });
      return c.json(await rasterMapResult(raster, indicator));
    } catch (reason) {
      if (reason instanceof ImpactGeoCoverageNotFoundError) return c.json(emptyRasterMapResult(indicator));
      return failure(c, 'Map data unavailable', reason);
    }
  }
  if (indicator.type !== 'choropleth' || !indicator.level) return c.json({ error: 'Unsupported scoreboard map type' }, 400);
  if (typeof indicator.variable !== 'string' || indicator.variable.trim().length === 0) {
    return c.json({ error: 'Invalid scoreboard map configuration' }, 400);
  }
  try {
    const boundaries = await loadRegionalBoundaries(country.code, indicator.level as NutsLevel);
    const regionIds = [...new Set(boundaries.features.flatMap(({ properties }) => (typeof properties?.NUTS_ID === 'string' ? [properties.NUTS_ID] : [])))];
    if (!regionIds.length) return c.json(regionalMapResult([], indicator, scenario, year));
    const rows = await readScoreboardMapSeries(await source(c), indicator.variable, { scenario, regions: regionIds, year });
    return c.json(regionalMapResult(rows, indicator, scenario, year));
  } catch (reason) {
    return failure(c, 'Map data unavailable', reason);
  }
});

export { scoreboard };
