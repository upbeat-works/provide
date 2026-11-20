import { Hono } from 'hono';
import type { Env } from '../types';
import { instances } from '../instances';
import { createPlatform } from '../platform';
import { loadScoreboardChart, validateChart } from '../scoreboard/charts';
import type { Definition } from '../scoreboard/types';

const charts = new Hono<Env>();

charts.post('/', async (c) => {
  c.header('Cache-Control', 'no-store');
  let definition: Definition;
  try {
    definition = await c.req.json();
    validateChart(definition);
  } catch (reason) {
    return c.json({ error: reason instanceof Error ? reason.message : 'Invalid chart JSON' }, 400);
  }
  const instanceSlug = c.req.query('instance');
  const scenario = c.req.query('scenario');
  const region = c.req.query('region');
  const year = c.req.query('year');
  if (!instanceSlug || !scenario || !region || !year || !/^\d{4}$/.test(year)) {
    return c.json({ error: 'instance, scenario, region and a four-digit year are required' }, 400);
  }
  const instance = instances.find(({ slug }) => slug === instanceSlug);
  if (!instance) return c.json({ error: `Unknown instance: ${instanceSlug}` }, 404);
  try {
    const platform = await createPlatform(instance, c.env.IXMP4_USERNAME, c.env.IXMP4_PASSWORD);
    return c.json(await loadScoreboardChart(platform, c.env.DB, definition, { scenario, region, year: Number(year) }));
  } catch (reason) {
    console.error('Chart data unavailable', { instance: instanceSlug, reasonName: reason instanceof Error ? reason.name : typeof reason });
    return c.json({ error: 'Chart data unavailable' }, 502);
  }
});

export { charts };
