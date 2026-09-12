import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { parseRequiredInstance, type ExploreDefaultsResponse } from '../catalog/contracts';
import { FACET_DEFAULTS, parseVariable } from '../conventions';
import { schema } from '../db';
import { createPlatform } from '../platform';
import type { Env } from '../types';

const exploreDefaults = new Hono<Env>();

function medianFacetedVariables(names: string[]): Set<string> {
  return new Set(names.filter((name) => {
    const variable = parseVariable(name);
    return variable.kind === 'faceted' && variable.value?.kind === 'percentile' && variable.value.number === 50;
  }));
}

function intersection<T>(sets: Set<T>[]): Set<T> {
  if (!sets.length) return new Set();
  return new Set([...sets[0]].filter((value) => sets.slice(1).every((set) => set.has(value))));
}

function candidateOrder(a: string, b: string): number {
  const presentA = parseVariable(a).period === FACET_DEFAULTS.period ? 0 : 1;
  const presentB = parseVariable(b).period === FACET_DEFAULTS.period ? 0 : 1;
  if (presentA !== presentB) return presentA - presentB;
  return a.localeCompare(b);
}

exploreDefaults.get('/', async (c) => {
  const scenarios = (c.req.queries('scenario') ?? []).filter(Boolean);
  if (!scenarios.length) return c.json({ error: 'scenario is required' }, 400);
  if (scenarios.length > 3) return c.json({ error: 'At most 3 scenarios are allowed' }, 400);

  const instance = parseRequiredInstance(c.req.query('instance'));
  if ('status' in instance) return c.json({ error: instance.error }, instance.status);

  try {
    const platform = await createPlatform(instance, c.env.IXMP4_USERNAME, c.env.IXMP4_PASSWORD);
    const variableSets = await Promise.all(
      scenarios.map(async (scenario) => medianFacetedVariables((await platform.iamc.variables.list({ run: { scenario: { name_ilike: scenario } } })).map(({ name }) => name)))
    );
    const candidates = [...intersection(variableSets)].sort(candidateOrder);
    const selectableRows = await c.env.DB.select({ id: schema.geographies.id })
      .from(schema.geographies)
      .innerJoin(schema.geographyTypes, eq(schema.geographies.geographyType, schema.geographyTypes.id))
      .where(and(eq(schema.geographyTypes.isAvailable, true), eq(schema.geographyTypes.isSelectable, true)));
    const selectable = new Set(selectableRows.map(({ id }) => id));

    for (const candidate of candidates) {
      const regionSets = await Promise.all(
        scenarios.map(async (scenario) => new Set((await platform.regions.list({ iamc: { variable: { name: candidate }, run: { scenario: { name_ilike: scenario } } } })).map(({ name }) => name)))
      );
      const geography = [...intersection(regionSets)].filter((id) => selectable.has(id)).sort((a, b) => a.localeCompare(b))[0];
      if (!geography) continue;

      const variable = parseVariable(candidate);
      const response: ExploreDefaultsResponse = {
        indicator: { id: variable.indicator, instance: instance.slug },
        geography,
        parameters: {
          reference: variable.period!,
          time: variable.temporal!,
          spatial: variable.spatial!,
        },
        scenarios,
      };
      return c.json(response);
    }
    return c.json({ error: 'No shared impact data for the requested scenarios' }, 404);
  } catch (reason) {
    const errorType = reason instanceof Error ? reason.name : 'NonErrorRejection';
    console.error('Explore defaults source unavailable', { instance: instance.slug, errorType });
    return c.json({ error: 'Explore defaults source unavailable' }, 502);
  }
});

export { exploreDefaults };
