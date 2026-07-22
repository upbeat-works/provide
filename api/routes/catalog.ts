import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types';
import { schema } from '../db';
import { createPlatforms } from '../platform';
import { parseVariable, indicatorsFromVariables } from '../conventions';
import { distinct, distinctCaseInsensitive, createTtlCache } from '../util';

const catalog = new Hono<Env>();

// The catalog reflects the ixmp4 variable universe + the curation enrichment
// table; both change only when data is (re)published, so the ~0.5 s scan is wasted
// on every page load. Cache the assembled payload for a few minutes — the whole
// deployment shares one logical catalog, so a single key suffices.
const CATALOG_TTL_MS = 10 * 60 * 1000;
type CatalogResponse = Awaited<ReturnType<typeof buildCatalog>>;
const catalogCache = createTtlCache<CatalogResponse>(CATALOG_TTL_MS);

// Test seam: drop the cached catalog so a test starts from a cold scan.
export function __resetCatalogCache(): void {
  catalogCache.clear();
}

// The convention-derived catalog: the searchable indicators (with their facet
// values + parameter dimensions) and the scenario universe. Both come straight
// from ixmp4 — variables.list collapsed by the naming convention, runs.list for
// scenarios — with no curation. This is the expensive slice (it scans every
// variable name), so it loads only on the data-exploring sections, never on the
// global layout.
catalog.get('/', async (c) => {
  const payload = await catalogCache.get('catalog', () => buildCatalog(c));
  return c.json(payload);
});

async function buildCatalog(c: Context<Env>) {
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
  const platforms = await createPlatforms(username, password);

  const [instanceVariables, instanceRuns] = await Promise.all([
    Promise.all(
      platforms.map(async ({ instance, platform }) => {
        const variables = await platform.iamc.variables.list();
        return variables.map((v) => ({ name: v.name, instance: instance.slug }));
      }),
    ),
    Promise.all(platforms.map(({ platform }) => platform.runs.list())),
  ]);

  const variablesFlat = instanceVariables.flat();
  // Collapse the raw ixmp4 variable strings into one searchable indicator each,
  // carrying its available facet values — derived purely from the naming
  // convention (no curation). Track the source instance per indicator.
  const instanceByIndicator = new Map<string, string>();
  for (const { name, instance } of variablesFlat) {
    const { indicator } = parseVariable(name);
    if (!instanceByIndicator.has(indicator)) instanceByIndicator.set(indicator, instance);
  }
  const indicatorFacets = indicatorsFromVariables(variablesFlat.map((v) => v.name));
  // Map the convention facets onto the parameter keys the selector UI expects.
  // Values are raw convention strings (their own label); the warming-level and
  // percentile axes are the chart's value dimension, not user dropdowns.
  // Additive curated enrichment (sector + legacy translation uid) that ixmp4
  // can't tag onto variables. Left-joined by indicator id; a missing row leaves
  // the indicator unchanged.
  const enrichmentRows = await c.env.DB.select().from(schema.indicators);
  const enrichmentById = new Map(enrichmentRows.map((r) => [r.id, r]));

  const indicators = indicatorFacets.map((ind) => {
    const extra = enrichmentById.get(ind.uid);
    return {
      ...ind,
      instance: instanceByIndicator.get(ind.uid),
      parameters: {
        time: ind.temporals,
        reference: ind.periods,
        spatial: ind.spatials,
      },
      ...(extra ? { sector: extra.sector, legacyUid: extra.legacyUid } : {}),
    };
  });

  // The global parameter dictionary: one entry per dimension, options = the
  // union of raw facet values across indicators (uid === label).
  const optionUnion = (key: 'temporals' | 'periods' | 'spatials') =>
    distinct(indicatorFacets.flatMap((ind) => ind[key])).map((value) => ({ uid: value, label: value }));
  const indicatorParameters = [
    { uid: 'time', label: 'Time', options: optionUnion('temporals') },
    { uid: 'reference', label: 'Reference', options: optionUnion('periods') },
    { uid: 'spatial', label: 'Spatial', options: optionUnion('spatials') },
  ].filter((p) => p.options.length);

  // Scenarios are derived straight from the ixmp4 runs — the scenario name is
  // the id (convention-driven, no curation). Case-only duplicate runs (e.g. the
  // `SSP5-3.4-OS`/`SSP5-3.4-Os` pair whose data is split across the two) collapse
  // to one canonical entry so the selector shows it once; the views match the
  // requested name case-insensitively to reach either casing's data.
  const scenarioNames = distinctCaseInsensitive(instanceRuns.flat().map((run) => run.scenario.name));
  const scenarios = scenarioNames.map((name) => ({ uid: name, label: name }));

  return { indicators, indicatorParameters, scenarios };
}

export { catalog };
