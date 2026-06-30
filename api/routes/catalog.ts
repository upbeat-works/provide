import { Hono } from 'hono';
import type { Env } from '../types';
import { createPlatforms } from '../platform';
import { parseVariable, indicatorsFromVariables } from '../conventions';
import { distinct } from '../util';

const catalog = new Hono<Env>();

// The convention-derived catalog: the searchable indicators (with their facet
// values + parameter dimensions) and the scenario universe. Both come straight
// from ixmp4 — variables.list collapsed by the naming convention, runs.list for
// scenarios — with no curation. This is the expensive slice (it scans every
// variable name), so it loads only on the data-exploring sections, never on the
// global layout.
catalog.get('/', async (c) => {
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
  // the id (convention-driven, no curation).
  const scenarioNames = distinct(instanceRuns.flat().map((run) => run.scenario.name));
  const scenarios = scenarioNames.map((name) => ({ uid: name, label: name }));

  return c.json({ indicators, indicatorParameters, scenarios });
});

export { catalog };
