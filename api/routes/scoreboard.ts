import { Hono, type Context } from 'hono';
import type { Env } from '../types';
import { instances } from '../instances';
import { createPlatform } from '../platform';
import { readDefaultRunSeries } from '../views/scoreboard';
import { getScoreboard, SCOREBOARD_INSTANCE } from '../scoreboard/controller.js';
import { loadRegionCatalog, mapMembers } from '../scoreboard/regions';
import { countryMapValues, r9MapValues } from '../scoreboard/maps';
import { loadScoreboardOptions } from '../scoreboard/options';
import { definitionGroupingError, loadScoreboardChart } from '../scoreboard/charts';
import type { Definition, MapDefinition, Selection } from '../scoreboard/types';

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

scoreboard.get('/options', async (c) => {
  const { definitions, mapDefinition } = getScoreboard(c.req.query('sector'));
  try {
    const result = await loadScoreboardOptions(await source(c), c.env.DB, definitions as Definition[], mapDefinition as MapDefinition, {
      scenario: c.req.query('scenario'),
      region: c.req.query('region'),
    });
    return c.json(result);
  } catch (reason) {
    return failure(c, 'Scoreboard choices unavailable', reason);
  }
});

scoreboard.get('/charts/:chartId', async (c) => {
  const { definitions } = getScoreboard(c.req.query('sector'));
  const definition = definitions.find(({ chartId }) => chartId === c.req.param('chartId')) as Definition | undefined;
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
  const { mapDefinition } = getScoreboard(c.req.query('sector'));
  const definition = mapDefinition as MapDefinition | undefined;
  if (!definition) return c.json({ error: 'Map not found' }, 404);
  const selection = selectionFromRequest(c);
  if (!selection) return c.json({ error: 'scenario, region and a four-digit year are required' }, 400);
  try {
    const [platform, catalog] = await Promise.all([source(c), loadRegionCatalog(c.env.DB)]);
    const members = mapMembers(definition.geographyType, selection.region, catalog);
    const included = new Set(members.map(({ uid }) => uid));
    const rows = await readDefaultRunSeries(platform, definition.data, { scenario: selection.scenario, regions: [...included], year: selection.year });
    let values;
    if (definition.geographyType === 'r9') values = r9MapValues(rows, selection.scenario, selection.year, included);
    else values = countryMapValues(rows, catalog.geographies, selection.scenario, selection.year, included);
    return c.json({ definition, status: values.length ? 'ready' : 'empty', values });
  } catch (reason) {
    return failure(c, 'Map data unavailable', reason);
  }
});

export { scoreboard };
