import { Hono } from 'hono';
import type { Env } from '../types';
import { instances } from '../instances';
import { fetchImpactTime, impactTimeToCsv } from '../views/impact-time';
import { csvFilename, csvHeaders } from '../csv';

const impactTime = new Hono<Env>();

impactTime.get('/', async (c) => {
  const indicator = c.req.query('indicator');
  const geography = c.req.query('geography');
  const scenarios = c.req.queries('scenarios') ?? [];
  const instanceSlug = c.req.query('instance');

  if (!indicator || !geography || scenarios.length === 0 || !instanceSlug) {
    return c.json({ error: 'Missing required params: indicator, geography, scenarios, instance' }, 400);
  }

  const instance = instances.find((i) => i.slug === instanceSlug);
  if (!instance) {
    return c.json({ error: `Unknown instance: ${instanceSlug}` }, 404);
  }

  // Selector dropdowns send raw convention values under the UI's param keys;
  // map them onto the variable-name segments (undefined → adapter defaults).
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
  const data = await fetchImpactTime(
    instance,
    { username, password },
    {
      indicator,
      geography,
      scenarios,
      period: c.req.query('reference'),
      temporal: c.req.query('time'),
      spatial: c.req.query('spatial'),
    },
  );

  // The chart-frame download menu appends `format=` from the response's
  // `formats`; anything else stays the default JSON the chart itself reads.
  if (c.req.query('format') === 'csv') {
    return c.text(impactTimeToCsv(data, { indicator, geography }), 200, csvHeaders(csvFilename('impact-time', indicator, geography)));
  }
  return c.json(data);
});

export { impactTime };
