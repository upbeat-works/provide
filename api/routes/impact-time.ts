import { Hono } from 'hono';
import type { Env } from '../types';

/**
 * GET /api/impact-time
 *
 * Returns time series data for a given indicator, geography, and set of
 * scenarios. Routes to the specific ixmp4 instance that owns the indicator.
 *
 * Query params:
 *   - indicator:  variable id (e.g., "terclim-mean-temperature")
 *   - geography:  region id (e.g., "DEU")
 *   - scenarios:  scenario ids (repeatable, e.g., scenarios=curpol&scenarios=netzero)
 *   - instance:   ixmp4 instance id (resolved from indicator metadata)
 *   - time, reference, frequency, spatial, indicator_value: indicator option params
 *
 * Response shape (matches current Climate Analytics API):
 *   {
 *     yearStart: number,
 *     yearStep: number,
 *     title: string,
 *     description: string,
 *     model: string,
 *     source: string,
 *     parameters: { ... },
 *     formats: ["csv"],
 *     data: {
 *       [scenarioId]: [[min, value, max], ...],
 *     }
 *   }
 *
 * Implementation steps:
 * 1. Resolve target ixmp4 instance from indicator/instance param
 * 2. Map indicator + option params to ixmp4 variable name
 * 3. Map geography to ixmp4 region
 * 4. Query run.iamc.tabulate() for each scenario, including uncertainty bands
 * 5. Transform tabular IAMC data to compact [min, value, max] arrays
 * 6. Attach display metadata (title, model, source) from Strapi or meta-indicators
 */
const impactTime = new Hono<Env>();

impactTime.get('/', async (c) => {
  // TODO: implement when ixmp4 instances are connected
  return c.json({ error: 'Not implemented' }, 501);
});

export { impactTime };
