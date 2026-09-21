import { Hono } from 'hono';
import { parseRequiredInstance } from '../catalog/contracts';
import { instances } from '../instances';
import type { Env } from '../types';
import { fetchMethodologyScenarioDetails } from '../views/scenarios';

const methodologyScenarios = new Hono<Env>();

methodologyScenarios.get('/', async (c) => {
  let sources = instances;
  const requestedInstance = c.req.query('instance');
  if (requestedInstance !== undefined) {
    const instance = parseRequiredInstance(requestedInstance);
    if ('status' in instance) return c.json({ error: instance.error }, instance.status);
    sources = [instance];
  }

  try {
    const details = await Promise.all(
      sources.map(async (instance) => {
        try {
          return await fetchMethodologyScenarioDetails(instance, {
            username: c.env.IXMP4_USERNAME,
            password: c.env.IXMP4_PASSWORD,
          });
        } catch (reason) {
          const errorType = reason instanceof Error ? reason.name : 'NonErrorRejection';
          console.error('Scenario sources unavailable', { instance: instance.slug, errorType });
          throw reason;
        }
      })
    );
    return c.json(details.flat());
  } catch {
    return c.json({ error: 'Scenario sources unavailable' }, 502);
  }
});

export { methodologyScenarios };
