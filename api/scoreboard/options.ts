import type { Platform } from '@iiasa/ixmp4-ts';
import type { Db } from '../types';
import { readDefaultRunSeries, type ScoreboardVariableReference } from '../views/scoreboard';
import { childRegions, loadRegionCatalog, mapMembers, mapRegionOptions, supportedAreas } from './regions';
import { type Definition, type MapDefinition, option, referenceKey, uniqueSorted } from './types';

export async function loadScoreboardOptions(platform: Platform, db: Db, definitions: Definition[], map: MapDefinition | undefined, requested: { scenario?: string; region?: string }) {
  const references = new Map<string, ScoreboardVariableReference>();
  for (const definition of definitions) {
    for (const entry of definition.data.series) {
      for (const reference of Object.values(entry)) references.set(referenceKey(reference), reference);
    }
  }
  if (map) references.set(referenceKey(map.data), map.data);
  const refs = [...references.values()];
  const [catalog, scenarioLists] = await Promise.all([
    loadRegionCatalog(db),
    Promise.all(
      refs.map(async ({ variable, model, unit }) => {
        const runs = await platform.runs.list({ defaultOnly: true, model: { name: model }, iamc: { variable: { name: variable }, unit: { name: unit } } });
        return runs.map(({ scenario }) => scenario.name);
      })
    ),
  ]);
  const scenarios = uniqueSorted(scenarioLists.flat()).map(option);
  const mapIndex = refs.findIndex((ref) => map && referenceKey(ref) === referenceKey(map.data));
  const preferredScenarios = scenarioLists[mapIndex] ?? [];
  const scenario = scenarios.find(({ uid }) => uid === requested.scenario) ?? scenarios.find(({ uid }) => preferredScenarios.includes(uid)) ?? scenarios[0] ?? null;
  const scenarioGroups = new Set(definitions.filter(({ data }) => data.groupBy === 'scenario').flatMap(({ data }) => data.series.flatMap((entry) => Object.values(entry).map(referenceKey))));
  const availableEntries = await Promise.all(
    refs.map(async (reference, index) => {
      const key = referenceKey(reference);
      if (!scenarioGroups.has(key) && (!scenario || !scenarioLists[index].includes(scenario.uid))) return [key, []] as const;
      const regions = await platform.regions.list({
        iamc: {
          variable: { name: reference.variable },
          unit: { name: reference.unit },
          run: { defaultOnly: true, model: { name: reference.model }, ...(!scenarioGroups.has(key) && scenario ? { scenario: { name: scenario.uid } } : {}) },
        },
      });
      return [key, regions.map(({ name }) => name)] as const;
    })
  );
  const available = new Map<string, readonly string[]>(availableEntries);
  const regionsById = new Map<string, ReturnType<typeof option>>();
  for (const definition of definitions) {
    const ids = new Set(definition.data.series.flatMap((entry) => Object.values(entry).flatMap((ref) => available.get(referenceKey(ref)) ?? [])));
    for (const uid of ids) regionsById.set(uid, option(uid));
    if (definition.data.groupBy === 'region') {
      for (const area of supportedAreas(ids, catalog)) regionsById.set(area.uid, area);
    }
  }
  if (map) {
    for (const area of mapRegionOptions(map.geographyType, new Set(available.get(referenceKey(map.data))), catalog)) regionsById.set(area.uid, area);
  }
  const regions = [...regionsById.values()].sort((a, b) => a.label.localeCompare(b.label));
  let region = regionsById.get(requested.region ?? '') ?? null;
  if (!region) {
    if (map?.geographyType === 'admin0') region = regions.find(({ label }) => label === 'Europe') ?? null;
    region ??= regionsById.get('World') ?? regionsById.get('European Union (R9)') ?? regions[0] ?? null;
  }
  const scopes = new Map<string, Set<string>>();
  const addRegions = (ref: ScoreboardVariableReference, ids: string[]) => {
    const key = referenceKey(ref);
    const scope = scopes.get(key) ?? new Set<string>();
    for (const id of ids) if (available.get(key)?.includes(id)) scope.add(id);
    scopes.set(key, scope);
  };
  if (region) {
    for (const definition of definitions) {
      let ids = [region.uid];
      if (definition.data.groupBy === 'region') ids = childRegions(region.uid, catalog).map(({ uid }) => uid);
      for (const entry of definition.data.series) for (const ref of Object.values(entry)) addRegions(ref, ids);
    }
    if (map)
      addRegions(
        map.data,
        mapMembers(map.geographyType, region.uid, catalog).map(({ uid }) => uid)
      );
  }
  // ixmp4 exposes no year-only query; keep this probe inside the selected area.
  const yearResults = await Promise.allSettled(
    refs.map(async (ref) => {
      const key = referenceKey(ref);
      const ids = [...(scopes.get(key) ?? [])];
      if (!ids.length || !scenario) return [];
      const rows = await readDefaultRunSeries(platform, ref, { regions: ids, ...(!scenarioGroups.has(key) ? { scenario: scenario.uid } : {}) });
      return rows.flatMap((row) => Object.keys(row).filter((key) => /^\d{4}$/.test(key) && typeof row[key] === 'number' && Number.isFinite(row[key])));
    })
  );
  const yearLists = yearResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  const yearStatus = yearResults.some((result) => result.status === 'rejected') ? 'error' : 'ready';
  return {
    status: 'ready',
    yearStatus,
    yearError: yearStatus === 'error' ? 'Years could not be loaded.' : null,
    scenarios,
    regions,
    years: uniqueSorted(yearLists).map(option),
    selection: { scenario, region },
  };
}
