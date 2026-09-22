import type { Platform } from '@iiasa/ixmp4-ts';
import type { Db } from '../types';
import { readDefaultRunSeries, selectScoreboardData } from '../views/scoreboard';
import { childRegions, loadRegionCatalog, worldR9Regions } from './regions';
import { type Definition, type Selection, option, referenceKey, uniqueSorted } from './types';

export function definitionGroupingError(definition: Definition): string | null {
  const groupBy = definition.data.groupBy;
  if (groupBy === undefined) return null;
  if (groupBy !== 'region' && groupBy !== 'scenario') return 'Unsupported chart grouping';
  if (definition.chartType !== 'stacked_bar' && definition.chartType !== 'bubble') return 'Unsupported chart grouping';
  return null;
}

export async function loadScoreboardChart(platform: Platform, db: Db, definition: Definition, selection: Selection) {
  const { groupBy, series } = definition.data;
  let groups = [option(selection.region)];
  if (groupBy === 'region') {
    if (definition.data.regions) groups = definition.data.regions.map(option);
    else if (selection.region === 'World') groups = worldR9Regions();
    else groups = childRegions(selection.region, await loadRegionCatalog(db));
  }
  const references = new Map(series.flatMap((entry) => Object.values(entry).map((reference) => [referenceKey(reference), reference] as const)));
  const scope = {
    regions: groups.map(({ uid }) => uid),
    ...(groupBy !== 'scenario' ? { scenario: selection.scenario } : {}),
    ...(definition.chartType !== 'line' && definition.chartType !== 'line_with_range' ? { year: selection.year } : {}),
  };
  const resolved = new Map(await Promise.all([...references].map(async ([key, ref]) => [key, await readDefaultRunSeries(platform, ref, scope)] as const)));
  const resolveSeries = (scenario: string, region: string) =>
    series.map((entry) =>
      Object.fromEntries(
        Object.entries(entry).map(([role, reference]) => {
          const points = selectScoreboardData(resolved.get(referenceKey(reference)) ?? [], { scenario, region });
          if (role === 'line' || role === 'rangeLow' || role === 'rangeHigh') return [role, points];
          return [role, points.find(({ year }) => year === selection.year)?.value ?? null];
        })
      )
    );
  const complete = (entries: ReturnType<typeof resolveSeries>) => {
    if (definition.chartType === 'bubble') return entries.some(({ x, y, size }) => Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(size) && Number(size) > 0);
    return entries.every((entry) => Object.values(entry).every((value) => typeof value === 'number' && Number.isFinite(value)));
  };
  if (groupBy === 'scenario') {
    const scenarios = uniqueSorted([...resolved.values()].flatMap((rows) => rows.map((row) => String(row.scenario))));
    const data = scenarios.flatMap((scenario) => {
      const series = resolveSeries(scenario, selection.region);
      return complete(series) ? [{ scenario: option(scenario), series }] : [];
    });
    return { definition, status: data.length ? 'ready' : 'empty', data };
  }
  if (groupBy === 'region') {
    const data = groups.flatMap((region) => {
      const series = resolveSeries(selection.scenario, region.uid);
      return complete(series) ? [{ region, series }] : [];
    });
    return { definition, status: data.length ? 'ready' : 'empty', data };
  }
  const data = resolveSeries(selection.scenario, selection.region);
  const hasValue = data.some((entry) =>
    Object.values(entry).some((value) => {
      if (typeof value === 'number') return Number.isFinite(value);
      return Array.isArray(value) && value.some((point) => point.value !== null);
    })
  );
  return { definition, status: hasValue ? 'ready' : 'empty', data };
}
