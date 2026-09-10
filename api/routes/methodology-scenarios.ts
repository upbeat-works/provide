import { Hono } from 'hono';
import { instances } from '../instances';
import type { Env } from '../types';
import { fetchMethodologyScenarioDetails } from '../views/scenarios';

const methodologyScenarios = new Hono<Env>();

methodologyScenarios.get('/', async (c) => {
  try {
    const details = await Promise.all(
      instances.map(async (instance) => {
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
