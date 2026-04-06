import { Hono } from 'hono';
import type { Env } from '../types';
import { createDb, schema } from '../db';
import { instances } from '../instances';

/**
 * GET /api/meta
 *
 * Assembles the full metadata response for the frontend by merging data from
 * three sources:
 *
 * 1. **ixmp4 instances** (fan out in parallel):
 *    - Indicators (variables) with available scenarios and geographies
 *    - Scenarios (runs) with characteristics and time series (GMT, emissions)
 *    - Sectors and tags (meta-indicators on runs)
 *    - Units
 *    - Parameter options (derived from variable naming conventions)
 *    Each indicator is tagged with its source instance id.
 *
 * 2. **Local SQL DB** (D1):
 *    - Geography types and geographies (hierarchy, coordinates)
 *
 * 3. **Strapi CMS** (fetched by the SvelteKit frontend, not here):
 *    - Indicator display config (description, colorScale, direction, icon)
 *    - Scenario descriptions and characteristics text
 *
 * Response shape matches the current Climate Analytics API so the frontend
 * can consume it without changes.
 */
const meta = new Hono<Env>();

meta.get('/', async (c) => {
  const db = createDb(c.env.DB);

  // SQL: geography data
  const [geographyTypes, geographies] = await Promise.all([
    db.select().from(schema.geographyTypes).orderBy(schema.geographyTypes.order),
    db.select().from(schema.geographies),
  ]);

  // TODO: Fan out to all ixmp4 instances for indicators, scenarios, sectors, units
  // const ixmp4Results = await Promise.all(instances.map(instance => queryInstance(instance)));
  // const { indicators, scenarios, sectors, units } = mergeIxmp4Results(ixmp4Results);

  return c.json({
    geographyTypes,
    geographies,
    indicators: [],
    scenarios: [],
    sectors: [],
    units: [],
  });
});

export { meta };
