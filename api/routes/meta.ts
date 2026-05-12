import { Hono } from 'hono';
import type { Env } from '../types';
import { schema } from '../db';
import { instances } from '../instances';
import { fetchRuns, fetchVariables } from '../ixmp4';
import { geographyTypes as geographyTypesCuration } from '../curation/geography-types';
import { scenarios as scenariosCuration, scenarioByUid } from '../curation/scenarios';
import { sectors as sectorsCuration } from '../curation/sectors';
import { indicatorByUid } from '../curation/indicators';
import { indicatorParameters } from '../curation/indicator-parameters';
import { studyLocations } from '../curation/study-locations';
import { likelihoods } from '../curation/likelihoods';

const meta = new Hono<Env>();

meta.get('/', async (c) => {
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;

  const [geographyTypeRows, geographyRows, instanceVariables, instanceRuns] =
    await Promise.all([
      c.env.DB.select().from(schema.geographyTypes),
      c.env.DB.select().from(schema.geographies),
      Promise.all(
        instances.map((i) =>
          fetchVariables(i.url, i.managerUrl, username, password).then((variables) =>
            variables.map((v) => ({ name: v.name, instance: i.slug })),
          ),
        ),
      ),
      Promise.all(
        instances.map((i) => fetchRuns(i.url, i.managerUrl, username, password)),
      ),
    ]);

  const geographyTypesByUid = new Map(geographyTypeRows.map((r) => [r.id, r]));
  const geographyTypes = geographyTypesCuration.map((meta) => {
    const db = geographyTypesByUid.get(meta.uid);
    return {
      ...meta,
      label: db?.label ?? meta.label,
      labelSingular: db?.labelSingular ?? meta.labelSingular,
      isAvailable: db?.isAvailable ?? meta.isAvailable,
    };
  });

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
    if (!curation) continue;
    seenIndicators.add(name);
    indicators.push({ ...curation, instance });
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
