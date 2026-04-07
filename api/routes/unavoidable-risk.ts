import { Hono } from 'hono';
import type { Env } from '../types';

/**
 * GET /api/unavoidable-risk
 *
 * Computes exceedance probabilities on-the-fly from ixmp4 ensemble data.
 * Routes to the specific ixmp4 instance that owns the indicator.
 *
 * Query params:
 *   - indicator:  variable id (e.g., "terclim-mean-temperature")
 *   - geography:  region id (e.g., "DEU")
 *   - scenarios:  scenario ids (repeatable)
 *   - instance:   ixmp4 instance id
 *   - time, reference, frequency, spatial, indicator_value: indicator option params
 *
 * Algorithm (from original Climate Analytics API):
 *
 *   For each threshold and year:
 *     1. Get all ensemble member values for the indicator at that year/geography
 *     2. Flatten across ensemble calibrations and runs
 *     3. Compute: risk = 1 - percentileofscore(values, threshold) / 100
 *        - This gives the probability of exceeding the threshold
 *        - For cold extremes (inverted): risk = percentileofscore(values, threshold) / 100
 *     4. "Today" values use baseline period (2011–2020)
 *
 *   Uncertainty bands in source data are [5th percentile, median, 95th percentile]
 *   across ensemble members.
 *
 *   Thresholds are indicator-specific (e.g., [0, 0.5, 1, ..., 5] for temperature,
 *   [0.95, 0.9, ..., 0.1] for biodiversity). Storage location TBD (ixmp4 meta-indicator
 *   or Strapi).
 *
 * Response shape (matches current Climate Analytics API):
 *   {
 *     thresholds: [number, ...],
 *     defaultThreshold: number,
 *     years: [number, ...],
 *     today: [percent, ...],
 *     data: {
 *       [scenarioId]: [
 *         [percent, ...],   // values per threshold at year[0]
 *         [percent, ...],   // values per threshold at year[1]
 *         ...
 *       ]
 *     },
 *     title, description, model, source, formats
 *   }
 */
const unavoidableRisk = new Hono<Env>();

unavoidableRisk.get('/', async (c) => {
  // TODO: implement when ixmp4 instances are connected
  return c.json({ error: 'Not implemented' }, 501);
});

export { unavoidableRisk };
