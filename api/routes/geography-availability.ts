import { Hono } from 'hono';
import { schema } from '../db';
import { parseRequiredInstance, validateCanonicalIndicatorId, type GeographyAvailabilityResponse } from '../catalog/contracts';
import { geographyIdsForIndicator, groupIndicatorVariableNames } from '../catalog/availability';
import { createPlatform } from '../platform';
import type { Env } from '../types';

const geographyAvailability = new Hono<Env>();

function errorType(reason: unknown): string {
  if (reason instanceof Error) return reason.name;
  return 'NonErrorRejection';
}

geographyAvailability.get('/', async (c) => {
  const indicator = c.req.query('indicator');
  if (!indicator) return c.json({ error: 'indicator is required' }, 400);
  const invalidIndicator = validateCanonicalIndicatorId(indicator);
  if (invalidIndicator) {
    return c.json({ error: invalidIndicator.error }, invalidIndicator.status);
  }

  const instance = parseRequiredInstance(c.req.query('instance'));
  if ('status' in instance) return c.json({ error: instance.error }, instance.status);

  let availableIds: string[];
  try {
    const platform = await createPlatform(instance, c.env.IXMP4_USERNAME, c.env.IXMP4_PASSWORD);
    const variables = await platform.iamc.variables.list({ name_ilike: `${indicator}|*` });
    const variableGroups = groupIndicatorVariableNames(variables.map(({ name }) => name));
    const indicatorExists = variableGroups.some(({ id }) => id === indicator);
    if (!indicatorExists) {
      return c.json({ error: `Indicator not found: ${indicator}` }, 404);
    }
    availableIds = await geographyIdsForIndicator(platform, indicator, variableGroups);
  } catch (reason) {
    console.error('Indicator source unavailable', {
      instance: instance.slug,
      errorType: errorType(reason),
    });
    return c.json({ error: 'Indicator source unavailable' }, 502);
  }

  const knownRows = await c.env.DB.select({ id: schema.geographies.id }).from(schema.geographies);
  const knownIds = new Set(knownRows.map(({ id }) => id));
  const response: GeographyAvailabilityResponse = {
    geographyIds: availableIds.filter((id) => knownIds.has(id)),
  };
  return c.json(response);
});

export { geographyAvailability };
