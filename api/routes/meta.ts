import { Hono } from 'hono';
import type { Env } from '../types';
import { schema } from '../db';
import { instances } from '../instances';
import { fetchVariables } from '../ixmp4';

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
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;

  const [geographyTypes, geographies, instanceVariables] = await Promise.all([
    c.env.DB.select().from(schema.geographyTypes).orderBy(schema.geographyTypes.order),
    c.env.DB.select().from(schema.geographies),
    Promise.all(
      instances.map(async (instance) => {
        const variables = await fetchVariables(instance.url, instance.managerUrl, username, password);
        return variables.map((v) => ({ id: v.name, instance: instance.slug }));
      }),
    ),
  ]);

  return c.json({
    geographyTypes,
    geographies,
    indicators: instanceVariables.flat(),
    scenarios: [],
    sectors: [],
    units: [],
  });
});

export { meta };
