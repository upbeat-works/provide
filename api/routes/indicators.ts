import { Hono } from 'hono';
import type { Platform, VariableFilter } from '@iiasa/ixmp4-ts';
import type { FilteredIndicatorIndexResponse, IndicatorIndexEntry, IndicatorIndexResponse } from '../catalog/contracts';
import type { Env, Ixmp4Instance } from '../types';
import { schema } from '../db';
import { instances } from '../instances';
import { createPlatform } from '../platform';
import { groupIndicatorVariableNames, type IndicatorVariableGroup } from '../catalog/availability';
import {
  FACET_KEYS,
  fetchRunFacetData,
  indicatorIdentity,
  resolveFacetSelection,
  sectorLabel,
  type FacetFilters,
  type IndicatorAttrs,
  type RunFacetData,
  type RunIndicators,
  type RunTags,
} from '../facets';

const route = new Hono<Env>();

type LoadedInstance = {
  instance: Ixmp4Instance;
  indicators: IndicatorIndexEntry[];
  facetData?: RunFacetData;
};

async function indicatorUnit(platform: Platform, variables: IndicatorVariableGroup): Promise<string> {
  const names = variables.percentileNames.length > 0 ? variables.percentileNames : variables.names;
  const units = await platform.units.list({ iamc: { variable: { name_in: names } } });
  if (!units[0]) throw new Error(`No unit for indicator ${variables.id}`);
  return units[0].name;
}

async function loadIndicatorEntries(platform: Platform, instance: Ixmp4Instance, variableFilter: VariableFilter): Promise<IndicatorIndexEntry[]> {
  const variables = await platform.iamc.variables.list(variableFilter);
  const groups = groupIndicatorVariableNames(variables.map(({ name }) => name));
  return Promise.all(
    groups.map(async (group) => ({
      id: group.id,
      label: group.id,
      unit: await indicatorUnit(platform, group),
      instance: instance.slug,
    }))
  );
}

async function loadIndexInstance(instance: Ixmp4Instance, username: string, password: string, variableFilter: VariableFilter): Promise<LoadedInstance> {
  const platform = await createPlatform(instance, username, password);
  const indicators = await loadIndicatorEntries(platform, instance, variableFilter);
  return { instance, indicators };
}

async function loadFilteredInstance(instance: Ixmp4Instance, username: string, password: string, variableFilter: VariableFilter, region?: string): Promise<LoadedInstance> {
  const platform = await createPlatform(instance, username, password);
  const [indicators, facetData] = await Promise.all([loadIndicatorEntries(platform, instance, variableFilter), fetchRunFacetData([{ instance, platform }], { region })]);
  return { instance, indicators, facetData };
}

function errorType(reason: unknown): string {
  if (reason instanceof Error) return reason.name;
  return 'NonErrorRejection';
}

function mergeFilters(loadedInstances: LoadedInstance[], filters: FacetFilters) {
  const runTags: RunTags = new Map();
  const runIndicators: RunIndicators = new Map();
  const indicatorAttrs: IndicatorAttrs = new Map();

  for (const loaded of loadedInstances) {
    const availableIds = new Set(loaded.indicators.map(({ id }) => id));
    for (const [runKey, tags] of loaded.facetData?.runTags ?? []) runTags.set(runKey, tags);
    for (const [runKey, ids] of loaded.facetData?.runIndicators ?? []) {
      runIndicators.set(
        runKey,
        ids.filter((id) => availableIds.has(id)).map((id) => indicatorIdentity(id, loaded.instance.slug))
      );
    }
    for (const indicator of loaded.indicators) {
      indicatorAttrs.set(indicatorIdentity(indicator.id, indicator.instance), {
        Sector: sectorLabel(indicator.sector),
        Project: loaded.instance.project,
      });
    }
  }

  return resolveFacetSelection(runTags, runIndicators, filters, indicatorAttrs);
}

route.get('/', async (c) => {
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
  const region = c.req.query('region');
  const variableFilter: VariableFilter = {};
  if (region) variableFilter.region = { name: region };

  const searchParams = new URL(c.req.url).searchParams;
  const filters: FacetFilters = {};
  let hasFacetFilters = false;
  for (const { key } of FACET_KEYS) {
    if (!searchParams.has(key)) continue;
    hasFacetFilters = true;
    filters[key] = (searchParams.get(key) ?? '').split(',').filter(Boolean);
  }

  const configuredInstances = [...instances];
  const pendingLoads = configuredInstances.map((instance) => {
    if (hasFacetFilters) return loadFilteredInstance(instance, username, password, variableFilter, region);
    return loadIndexInstance(instance, username, password, variableFilter);
  });
  const results = await Promise.allSettled(pendingLoads);
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') return;
    console.error('Indicator source unavailable', {
      instance: configuredInstances[index].slug,
      errorType: errorType(result.reason),
    });
  });
  const loadedInstances = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  if (loadedInstances.length === 0) {
    return c.json({ error: 'Indicator sources unavailable' }, 503);
  }

  const enrichmentRows = await c.env.DB.select().from(schema.indicators);
  const enrichmentById = new Map(enrichmentRows.map((row) => [row.id, row]));
  const enrichedInstances = loadedInstances.map((loaded) => ({
    ...loaded,
    indicators: loaded.indicators.map((indicator) => {
      const sector = enrichmentById.get(indicator.id)?.sector;
      if (!sector) return indicator;
      return { ...indicator, sector };
    }),
  }));
  const allIndicators = enrichedInstances.flatMap(({ indicators }) => indicators);

  const failedInstances = results.flatMap((result, index) => (result.status === 'rejected' ? [{ instance: configuredInstances[index].slug, code: 'unavailable' as const }] : []));
  const response: IndicatorIndexResponse = { indicators: allIndicators, failedInstances };
  if (!hasFacetFilters) return c.json(response);

  const selection = mergeFilters(enrichedInstances, filters);
  const filteredIndicators = allIndicators.filter(({ id, instance }) => selection.indicators.has(indicatorIdentity(id, instance)));
  const filteredResponse: FilteredIndicatorIndexResponse = {
    indicators: filteredIndicators,
    failedInstances,
    filters: FACET_KEYS.map(({ key, label, color }) => ({
      key,
      label,
      color,
      options: selection.facets[key] ?? [],
      selected: filters[key] ?? [],
    })),
  };
  return c.json(filteredResponse);
});

export { route as indicators };
