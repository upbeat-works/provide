import { Hono } from 'hono';
import type { Env } from '../types';
import { instances } from '../instances';
import { fetchImpactTime } from '../ixmp4';

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

  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
  const data = await fetchImpactTime(instance, { username, password }, { indicator, geography, scenarios });
  return c.json(data);
});

export { impactTime };
