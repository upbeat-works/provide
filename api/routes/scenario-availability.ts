import { Hono } from 'hono';
import { parseRequiredInstance, validateCanonicalIndicatorId, type ScenarioAvailabilityResponse } from '../catalog/contracts';
import type { Env } from '../types';
import { fetchScenarioAvailability, type ScenarioAxis } from '../views/scenarios';

const scenarioAvailability = new Hono<Env>();

scenarioAvailability.get('/', async (c) => {
  const indicator = c.req.query('indicator');
  const region = c.req.query('region');
  if (!indicator || !region) {
    return c.json({ error: 'indicator and region query parameters are required' }, 400);
  }
  const invalidIndicator = validateCanonicalIndicatorId(indicator);
  if (invalidIndicator) {
    return c.json({ error: invalidIndicator.error }, invalidIndicator.status);
  }

  const instance = parseRequiredInstance(c.req.query('instance'));
  if ('status' in instance) return c.json({ error: instance.error }, instance.status);

  const requestedAxis = c.req.query('axis');
  if (requestedAxis !== undefined && requestedAxis !== 'percentile' && requestedAxis !== 'warmingLevel') {
    return c.json({ error: `Invalid axis: ${requestedAxis}` }, 400);
  }
  let axis: ScenarioAxis = 'percentile';
  if (requestedAxis === 'warmingLevel') axis = 'warmingLevel';

  try {
    const scenarios = await fetchScenarioAvailability(
      instance,
      {
        username: c.env.IXMP4_USERNAME,
        password: c.env.IXMP4_PASSWORD,
      },
      {
        indicator,
        region,
        period: c.req.query('reference'),
        temporal: c.req.query('time'),
        spatial: c.req.query('spatial'),
        axis,
      }
    );
    if (scenarios === null) {
      return c.json({ error: `Indicator not found: ${indicator}` }, 404);
    }
    const response: ScenarioAvailabilityResponse = { scenarios };
    return c.json(response);
  } catch (reason) {
    const errorType = reason instanceof Error ? reason.name : 'NonErrorRejection';
    console.error('Scenario source unavailable', { instance: instance.slug, errorType });
    return c.json({ error: 'Scenario source unavailable' }, 502);
  }
});

export { scenarioAvailability };
