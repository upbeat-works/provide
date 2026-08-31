import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types';
import { schema } from '../db';
import { createPlatforms } from '../platform';
import { parseVariable, indicatorsFromVariables } from '../conventions';
import { distinct, distinctCaseInsensitive, createTtlCache } from '../util';
import { fetchScenarioTimeframes } from '../views/scenarios';
import { fetchGmtSeriesAcross } from '../views/gmt';
import { FACET_KEYS, fetchRunFacetData, resolveFacetSelection, citationsByIndicator, sectorLabel, type FacetFilters, type IndicatorAttrs } from '../facets';
import { indicatorDescriptions } from '../descriptions';

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
// The cached payload is the unfiltered universe; the active filters are applied
// per request in memory, so the cache key stays a constant.
catalog.get('/', async (c) => {
  const { runTags, runIndicators, indicatorAttrs, ...base } = await catalogCache.get('catalog', () =>
    buildCatalog(c),
  );

  const filters: FacetFilters = {};
  for (const { key } of FACET_KEYS) {
    const value = c.req.query(key);
    if (value) filters[key] = value.split(',');
  }

  const { indicators, facets } = resolveFacetSelection(runTags, runIndicators, filters, indicatorAttrs);
  const isFiltered = Object.keys(filters).length > 0;
  return c.json({
    ...base,
    indicators: isFiltered ? base.indicators.filter((i) => indicators.has(i.uid)) : base.indicators,
    // Ordered groups so the UI renders straight from the registry and keeps no
    // key list of its own.
    facets: FACET_KEYS.map(({ key, label, color }) => ({
      key,
      label,
      color,
      options: facets[key] ?? [],
      selected: filters[key] ?? [],
    })),
  });
});

async function buildCatalog(c: Context<Env>) {
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
  const platforms = await createPlatforms(username, password);

  const [instanceVariables, instanceRuns, facetData, gmt] = await Promise.all([
    Promise.all(
      platforms.map(async ({ instance, platform }) => {
        // Docs are per-variable and keyed by variable id, so both lists are
        // needed to attach the prose to a name. Two calls, not one per variable.
        const [variables, docs] = await Promise.all([
          platform.iamc.variables.list(),
          platform.backend.iamc.variables.docs.list(),
        ]);
        const proseById = new Map(docs.map((d) => [d.dimension__id, d.description]));
        return variables.map((v) => ({
          name: v.name,
          instance: instance.slug,
          project: instance.project,
          description: proseById.get(v.id) ?? '',
        }));
      }),
    ),
    Promise.all(platforms.map(({ platform }) => platform.runs.list())),
    fetchRunFacetData(platforms),
    // Three tabulates, and only on a cache miss — GMT is a property of every
    // scenario, so it is assembled once here rather than per request.
    fetchGmtSeriesAcross(platforms),
  ]);

  const variablesFlat = instanceVariables.flat();
  const descriptions = indicatorDescriptions(
    variablesFlat.map(({ name, description }) => ({ variable: name, description })),
  );
  const citations = citationsByIndicator(facetData.runIndicators, facetData.citations);
  const projectByIndicator = new Map<string, string | undefined>();
  for (const { name, project } of variablesFlat) {
    const { indicator } = parseVariable(name);
    if (!projectByIndicator.has(indicator)) projectByIndicator.set(indicator, project);
  }
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
    const cited = citations.get(ind.uid);
    return {
      ...ind,
      instance: instanceByIndicator.get(ind.uid),
      project: projectByIndicator.get(ind.uid),
      // Prose from the ixmp4 variable docs; Strapi may still override it.
      description: descriptions.get(ind.uid),
      models: cited?.models ?? [],
      sources: cited?.sources ?? [],
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
  //
  // The GMT emulator additionally publishes long-term variants of each scenario
  // ("… then Net Zero", "(Extended)") that reach 2300 but that no impact
  // indicator covers. They would enter every scenario picker with nothing behind
  // them, so the universe is the runs that carry impacts — i.e. everything the
  // emulator is not the sole publisher of. Its model name comes from the data,
  // not a constant.
  const gmtModel = [...gmt.values()][0]?.model;
  const impactRuns = instanceRuns.flat().filter((run) => !gmtModel || run.model.name !== gmtModel);
  const scenarioNames = distinctCaseInsensitive(impactRuns.map((run) => run.scenario.name));

  // Each scenario's timeframe, derived from the data itself (max year, not
  // curation) — the methodology scenario list keys its table columns on it, and
  // the timeline charts get their x-axis grid from the same probe.
  const timeframes = await fetchScenarioTimeframes(platforms, indicatorFacets, scenarioNames);
  const scenarios = scenarioNames.map((name) => {
    // Global mean temperature is a property of the scenario, not a selectable
    // indicator: the methodology timeline chart reads `gmt` and its table reads
    // `characteristics` straight off the scenario entry.
    const series = gmt.get(name.toLowerCase());
    return {
      uid: name,
      label: name,
      ...(timeframes.get(name.toLowerCase()) ?? {}),
      ...(series
        ? {
            gmt: { data: series.data, yearStart: series.yearStart, yearStep: series.yearStep },
            characteristics: series.characteristics,
          }
        : {}),
    };
  });

  // Sector/Project are faceted per indicator, not per run: sector is the curated
  // DB column, project is the ixmp4 instance. Sector is stored as a slug and
  // surfaced as its label, which is what the filter chips show and send back.
  const indicatorAttrs: IndicatorAttrs = new Map(
    indicators.map((ind) => [
      ind.uid,
      { Sector: sectorLabel(ind.sector), Project: ind.project },
    ]),
  );

  return {
    indicators,
    indicatorParameters,
    scenarios,
    runTags: facetData.runTags,
    runIndicators: facetData.runIndicators,
    indicatorAttrs,
  };
}

export { catalog };
