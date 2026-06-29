import { Hono } from 'hono';
import type { Env } from '../types';
import { schema } from '../db';
import { createPlatforms } from '../platform';
import { parseVariable, indicatorsFromVariables } from '../conventions';
import { distinct } from '../util';
import { studyLocations } from '../curation/study-locations';
import { likelihoods } from '../curation/likelihoods';

const meta = new Hono<Env>();

meta.get('/', async (c) => {
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
  const platforms = await createPlatforms(username, password);

  const [geographyTypeRows, geographyRows, parentRows, instanceVariables, instanceRuns] =
    await Promise.all([
      c.env.DB.select().from(schema.geographyTypes).orderBy(schema.geographyTypes.order),
      c.env.DB.select().from(schema.geographies),
      c.env.DB.select().from(schema.geographyParents),
      Promise.all(
        platforms.map(async ({ instance, platform }) => {
          const variables = await platform.iamc.variables.list();
          return variables.map((v) => ({ name: v.name, instance: instance.slug }));
        }),
      ),
      Promise.all(platforms.map(({ platform }) => platform.runs.list())),
    ]);

  const geographyTypes = geographyTypeRows.map((r) => ({
    uid: r.id,
    label: r.label,
    labelSingular: r.labelSingular ?? undefined,
    order: r.order ?? undefined,
    isAvailable: r.isAvailable ?? true,
    isSelectable: r.isSelectable ?? true,
  }));

  const parentsByChild: Record<string, string[]> = {};
  for (const r of parentRows) (parentsByChild[r.geographyId] ??= []).push(r.parentId);

  const geographiesByType: Record<
    string,
    Array<{ uid: string; label: string; geoId?: string; parents: string[] }>
  > = {};
  for (const geo of geographyRows) {
    (geographiesByType[geo.geographyType] ??= []).push({
      uid: geo.id,
      label: geo.label,
      geoId: geo.geoId ?? undefined,
      parents: parentsByChild[geo.id] ?? [],
    });
  }

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
  const indicators = indicatorFacets.map((ind) => ({
    ...ind,
    instance: instanceByIndicator.get(ind.uid),
    parameters: {
      time: ind.temporals,
      reference: ind.periods,
      spatial: ind.spatials,
    },
  }));

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
  // the id (convention-driven, no curation). GMT/characteristics that used to be
  // curated here now ride along with the impact-time data instead.
  const scenarioNames = distinct(instanceRuns.flat().map((run) => run.scenario.name));
  const scenarios = scenarioNames.map((name) => ({ uid: name, label: name }));

  return c.json({
    geographyTypes,
    ...geographiesByType,
    scenarios,
    indicators,
    indicatorParameters,
    studyLocations,
    likelihoods,
  });
});

export { meta };
