import { Hono } from 'hono';
import type { Env } from '../types';

/**
 * GET /api/unavoidable-risk
 *
 * Computes exceedance probabilities on-the-fly from raw IAMC data in ixmp4.
 * Routes to the specific ixmp4 instance that owns the indicator.
 *
 * Query params:
 *   - indicator:  variable id
 *   - geography:  region id
 *   - scenarios:  scenario ids (repeatable)
 *   - instance:   ixmp4 instance id
 *   - time, reference, frequency, spatial, indicator_value: indicator option params
 *
 * Response shape (matches current Climate Analytics API):
 *   {
 *     thresholds: [number, ...],
 *     defaultThreshold: number,
 *     years: [number, ...],
 *     today: [percent, ...],       // one per threshold
 *     data: {
 *       [scenarioId]: [
 *         [percent, ...],          // values per threshold at year[0]
 *         [percent, ...],          // values per threshold at year[1]
 *         ...
 *       ]
 *     },
 *     title, description, model, source, formats
 *   }
 *
 * Implementation steps:
 * 1. Resolve target ixmp4 instance
 * 2. Fetch raw IAMC time series for the indicator across requested scenarios
 * 3. Determine thresholds (from ixmp4 meta-indicators or client request)
 * 4. For each threshold: compute probability of exceedance at each future year
 *    (algorithm TBD — awaiting documentation from Climate Analytics)
 * 5. Compute "today's risk" from historical/baseline data
 * 6. Return in the expected response shape
 */
const unavoidableRisk = new Hono<Env>();

unavoidableRisk.get('/', async (c) => {
  // TODO: implement when ixmp4 instances are connected and exceedance algorithm is defined
  return c.json({ error: 'Not implemented' }, 501);
});

export { unavoidableRisk };
