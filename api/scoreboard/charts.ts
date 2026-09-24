import type { Platform } from '@iiasa/ixmp4-ts';
import type { Db } from '../types';
import { readDefaultRunSeries, selectScoreboardData } from '../views/scoreboard';
import { childRegions, loadRegionCatalog, worldR9Regions } from './regions';
import { loadRegionalBoundaries } from './boundaries';
import { scoreboardCountry } from './countries';
import { chartSeries } from './series';
import { type Definition, type Selection, option, referenceKey, uniqueSorted } from './types';

export function definitionGroupingError(definition: Definition): string | null {
  const groupBy = definition.data.groupBy;
  if (groupBy !== undefined && groupBy !== 'region' && groupBy !== 'scenario') return 'Unsupported chart grouping';
  if (groupBy !== undefined && !['stacked_bar', 'bubble', 'scatter'].includes(definition.chartType) && !(groupBy === 'region' && definition.chartType === 'line')) return 'Unsupported chart grouping';
  try {
    chartSeries(definition.data, definition.chartType);
    return null;
  } catch (error) {
    return error.message;
  }
}

export async function loadScoreboardChart(platform: Platform, db: Db, definition: Definition, selection: Selection) {
  const { groupBy } = definition.data;
  const error = definitionGroupingError(definition);
  if (error) throw new Error(error);
  const series = chartSeries(definition.data, definition.chartType);
  let groups = [option(selection.region)];
  if (groupBy === 'region') {
    if (definition.data.regions) groups = definition.data.regions.map(option);
    else if (definition.data.regionLevel) {
      const country = scoreboardCountry(selection.region);
      groups = [];
      if (country) {
        const boundaries = await loadRegionalBoundaries(country.code, definition.data.regionLevel);
        groups = boundaries.features.flatMap(({ properties }) => {
          if (typeof properties?.NUTS_ID !== 'string') return [];
          return [{ uid: properties.NUTS_ID, label: String(properties.NAME_LATN ?? properties.NUTS_ID) }];
        }).sort((a, b) => a.label.localeCompare(b.label));
      }
    } else if (selection.region === 'World') groups = worldR9Regions();
    else groups = childRegions(selection.region, await loadRegionCatalog(db));
  }
  const references = new Map(series.flatMap((entry) => Object.values(entry).map((reference) => [referenceKey(reference), reference] as const)));
  const scope = {
    regions: groups.map(({ uid }) => uid),
    ...(groupBy !== 'scenario' ? { scenario: selection.scenario } : {}),
    ...(definition.chartType !== 'line' && definition.chartType !== 'line_with_range' ? { year: selection.year } : {}),
  };
  const resolved = new Map(await Promise.all([...references].map(async ([key, ref]) => [key, await readDefaultRunSeries(platform, ref, scope)] as const)));
  const resolvedSeries = series.map((entry) => Object.fromEntries(Object.entries(entry).map(([role, reference]) => {
    const rows = resolved.get(referenceKey(reference)) ?? [];
    const model = uniqueSorted(rows.flatMap((row) => typeof row.model === 'string' && row.model ? [row.model] : [])).join(', ');
    const units = new Set(rows.map(({ unit }) => {
      if (typeof unit === 'string' && unit.trim()) return unit;
      return reference.unit ?? reference.unitFallback;
    }).filter(Boolean));
    if (units.size > 1) throw new Error('Ambiguous source units');
    const unit = [...units][0] ?? reference.unit ?? reference.unitFallback;
    return [role, { ...reference, ...(model ? { model } : {}), ...(unit ? { unit } : {}) }];
  })));
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
  const hasValues = (entries: ReturnType<typeof resolveSeries>) => {
    if (definition.chartType === 'bubble') return entries.some(({ x, y, size }) => Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(size) && Number(size) > 0);
    if (definition.chartType === 'scatter') return entries.some(({ x, y }) => Number.isFinite(x) && Number.isFinite(y));
    return entries.some((entry) => Object.values(entry).some((value) => {
      if (typeof value === 'number') return Number.isFinite(value);
      return Array.isArray(value) && value.some((point) => Number.isFinite(point.value));
    }));
  };
  if (groupBy === 'scenario') {
    const scenarios = uniqueSorted([...resolved.values()].flatMap((rows) => rows.map((row) => String(row.scenario))));
    const data = scenarios.flatMap((scenario) => {
      const series = resolveSeries(scenario, selection.region);
      return hasValues(series) ? [{ scenario: option(scenario), series }] : [];
    });
    return { definition, series: resolvedSeries, status: data.length ? 'ready' : 'empty', data };
  }
  if (groupBy === 'region') {
    const data = groups.flatMap((region) => {
      const series = resolveSeries(selection.scenario, region.uid);
      return hasValues(series) ? [{ region, series }] : [];
    });
    return { definition, series: resolvedSeries, status: data.length ? 'ready' : 'empty', data };
  }
  const data = resolveSeries(selection.scenario, selection.region);
  const hasValue = data.some((entry) =>
    Object.values(entry).some((value) => {
      if (typeof value === 'number') return Number.isFinite(value);
      return Array.isArray(value) && value.some((point) => point.value !== null);
    })
  );
  return { definition, series: resolvedSeries, status: hasValue ? 'ready' : 'empty', data };
}
