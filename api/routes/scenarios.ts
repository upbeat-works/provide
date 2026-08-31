import { Hono } from 'hono';
import type { Env } from '../types';
import { instances } from '../instances';
import { fetchScenarioAvailability, type ScenarioAxis } from '../views/scenarios';

const route = new Hono<Env>();

// The scenarios (and each one's timeframe) that have data for an indicator in a
// region, for the current parameter selection — derived from ixmp4, no curation.
route.get('/', async (c) => {
  const indicator = c.req.query('indicator');
  const region = c.req.query('region');
  if (!indicator || !region) {
    return c.json({ error: 'indicator and region query parameters are required' }, 400);
  }

  const instanceSlug = c.req.query('instance');
  const instance = instanceSlug ? instances.find((i) => i.slug === instanceSlug) : instances[0];
  if (!instance) {
    return c.json({ error: `Unknown instance: ${instanceSlug}` }, 404);
  }

  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
  // The avoid view plots the warming-level axis, so it probes availability there
  // (`axis=warmingLevel`); everything else defaults to the percentile axis.
  const axis: ScenarioAxis = c.req.query('axis') === 'warmingLevel' ? 'warmingLevel' : 'percentile';
  // Selector dropdowns send raw convention values under the UI's param keys.
  const scenarios = await fetchScenarioAvailability(
    instance,
    { username, password },
    {
      indicator,
      region,
      period: c.req.query('reference'),
      temporal: c.req.query('time'),
      spatial: c.req.query('spatial'),
      axis,
    },
  );
  return c.json({ scenarios });
});

export { route as scenarios };
