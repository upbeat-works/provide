import { Hono } from 'hono';
import { parseRequiredInstance } from '../catalog/contracts';
import type { Env } from '../types';
import { fetchScenarioDetail } from '../views/scenarios';

const scenarioDetails = new Hono<Env>();
const scenarioWildcardPattern = /[*?]/;

scenarioDetails.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (scenarioWildcardPattern.test(id)) {
    return c.json({ error: `Invalid scenario id: ${id}` }, 400);
  }

  const instance = parseRequiredInstance(c.req.query('instance'));
  if ('status' in instance) return c.json({ error: instance.error }, instance.status);

  try {
    const details = await fetchScenarioDetail(
      instance,
      {
        username: c.env.IXMP4_USERNAME,
        password: c.env.IXMP4_PASSWORD,
      },
      id
    );
    if (!details) return c.json({ error: `Scenario not found: ${id}` }, 404);
    return c.json(details);
  } catch (reason) {
    const errorType = reason instanceof Error ? reason.name : 'NonErrorRejection';
    console.error('Scenario source unavailable', { instance: instance.slug, errorType });
    return c.json({ error: 'Scenario source unavailable' }, 502);
  }
});

export { scenarioDetails };
