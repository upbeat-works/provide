import { Hono } from 'hono';
import type { Env } from '../types';
import { schema } from '../db';
import { createPlatforms } from '../platform';
import { scenarios as scenariosCuration } from '../curation/scenarios';
import { sectors as sectorsCuration } from '../curation/sectors';
import { indicatorByUid } from '../curation/indicators';
import { indicatorParameters } from '../curation/indicator-parameters';
import { studyLocations } from '../curation/study-locations';
import { likelihoods } from '../curation/likelihoods';

const meta = new Hono<Env>();

meta.get('/', async (c) => {
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
  const platforms = await createPlatforms(username, password);

  const [geographyTypeRows, geographyRows, instanceVariables, instanceRuns] =
    await Promise.all([
      c.env.DB.select().from(schema.geographyTypes).orderBy(schema.geographyTypes.order),
      c.env.DB.select().from(schema.geographies),
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
  }));

  const geographiesByType: Record<string, Array<{ uid: string; label: string }>> = {};
  for (const geo of geographyRows) {
    (geographiesByType[geo.geographyType] ??= []).push({ uid: geo.id, label: geo.label });
  }

  const variablesFlat = instanceVariables.flat();
  const seenIndicators = new Set<string>();
  const indicators: Array<Record<string, unknown>> = [];
  for (const { name, instance } of variablesFlat) {
    if (seenIndicators.has(name)) continue;
    const curation = indicatorByUid[name];
    seenIndicators.add(name);
    // Permissive: include all ixmp4 variables, even those without curation.
    // Variable name doubles as uid and display label; curated fields spread on top.
    indicators.push({ ...curation, uid: name, label: name, instance });
  }

  const scenariosAvailable = new Set<string>();
  for (const runs of instanceRuns) {
    for (const run of runs) scenariosAvailable.add(run.scenario.name);
  }
  const scenarios = scenariosCuration.filter((s) => scenariosAvailable.has(s.uid));

  return c.json({
    geographyTypes,
    ...geographiesByType,
    scenarios,
    sectors: sectorsCuration,
    indicators,
    indicatorParameters,
    studyLocations,
    likelihoods,
  });
});

export { meta };
