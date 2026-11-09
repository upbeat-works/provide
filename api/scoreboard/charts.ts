import type { Platform } from '@iiasa/ixmp4-ts';
import type { Db } from '../types';
import { aggregateScoreboardData, readDefaultRunSeries, selectScoreboardData } from '../views/scoreboard';
import { childRegions, loadRegionCatalog, worldR9Regions } from './regions';
import { loadRegionalBoundaries } from './boundaries';
import { SCOREBOARD_COUNTRIES, scoreboardCountry } from './countries';
import { chartSeries } from './series';
import { type Definition, type Selection, option, referenceKey, uniqueSorted } from './types';

export function validateChart(definition: Definition) {
  const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  if (!text(definition?.chartId)) throw new Error('chartId is required');
  const { chartId } = definition;
  if (definition.hideInEuropeView !== undefined && typeof definition.hideInEuropeView !== 'boolean') throw new Error(`${chartId}: hideInEuropeView must be a boolean`);
  if (definition.decimals !== undefined && !(Number.isInteger(definition.decimals) && definition.decimals >= 0 && definition.decimals <= 6)) throw new Error(`${chartId}: decimals must be a whole number from 0 to 6`);
  if (!text(definition.title) || typeof definition.description !== 'string') throw new Error(`${chartId}: title and description are required`);
  if (!Array.isArray(definition.data?.variables) || !definition.data.variables.every(text)) throw new Error(`${chartId}: variables must be strings`);
  const error = definitionGroupingError(definition);
  if (error) throw new Error(`${chartId}: ${error}`);
}

export function definitionGroupingError(definition: Definition): string | null {
  const { groupBy, regions, regionLevel, aggregate } = definition.data;
  if (groupBy !== undefined && groupBy !== 'region' && groupBy !== 'scenario') return 'Unsupported chart grouping';
  if (groupBy !== undefined && !['stacked_bar', 'bubble', 'scatter', 'box_plot'].includes(definition.chartType) && !(groupBy === 'region' && ['line', 'line_with_range'].includes(definition.chartType))) return 'Unsupported chart grouping';
  if (regions !== undefined && (!Array.isArray(regions) || !regions.every((region) => typeof region === 'string' && region.trim().length > 0))) return 'regions must be an array of nonempty strings';
  if (regionLevel !== undefined && !['NUTS1', 'NUTS2'].includes(regionLevel)) return 'regionLevel must be NUTS1 or NUTS2';
  if (aggregate !== undefined && aggregate !== 'sum') return 'aggregate must be sum';
  // Aggregation rolls sub-regions into countries, so there has to be a level to
  // roll up from.
  if (aggregate && !regionLevel) return 'Aggregation requires a region level';
  // Percentiles do not add: the 95th percentile of a country is not the sum of
  // its regions' 95th percentiles.
  if (aggregate && definition.chartType === 'box_plot') return 'A box plot cannot be aggregated';
  try {
    chartSeries(definition.data, definition.chartType);
    return null;
  } catch (error) {
    return error.message;
  }
}

export async function loadScoreboardChart(platform: Platform, db: Db, definition: Definition, selection: Selection) {
  if (selection.region === 'all' && !definition.data.groupBy) {
    definition = { ...definition, data: { ...definition.data, groupBy: 'region' } };
  }
  const { groupBy } = definition.data;
  const error = definitionGroupingError(definition);
  if (error) throw new Error(error);
  const series = chartSeries(definition.data, definition.chartType);
  let groups = [option(selection.region)];
  // Which sub-regions each drawn group is summed from, when a chart aggregates.
  let members: Map<string, string[]> | undefined;
  if (groupBy === 'region') {
    if (definition.data.regions) groups = definition.data.regions.map(option);
    else if (definition.data.regionLevel) {
      const country = scoreboardCountry(selection.region);
      groups = [];
      if (country || selection.region === 'all') {
        const boundaries = await loadRegionalBoundaries(country?.code, definition.data.regionLevel);
        const regions = boundaries.features.flatMap(({ properties }) => {
          if (typeof properties?.NUTS_ID !== 'string') return [];
          return [{ uid: properties.NUTS_ID, label: String(properties.NAME_LATN ?? properties.NUTS_ID) }];
        });
        // Across the whole of Europe an aggregating chart draws its countries,
        // each summed from the sub-regions it is published at — those variables
        // have no country-level series of their own to read.
        if (selection.region === 'all' && definition.data.aggregate === 'sum') {
          members = new Map();
          for (const { uid } of regions) {
            // A NUTS id opens with its country's code, which is the same code
            // the scoreboard lists its countries by (EL for Greece included).
            const name = SCOREBOARD_COUNTRIES.find(({ code }) => code === uid.slice(0, 2))?.name;
            if (!name) continue;
            members.set(name, [...(members.get(name) ?? []), uid]);
          }
          groups = [...members.keys()].sort((a, b) => a.localeCompare(b)).map(option);
        } else groups = regions.sort((a, b) => a.label.localeCompare(b.label));
      }
    } else if (selection.region === 'all') groups = SCOREBOARD_COUNTRIES.map(({ name }) => option(name));
    else if (selection.region === 'World') groups = worldR9Regions();
    else groups = childRegions(selection.region, await loadRegionCatalog(db));
  }
  const references = new Map(series.flatMap((entry) => Object.values(entry).map((reference) => [referenceKey(reference), reference] as const)));
  const scope = {
    // An aggregating chart still queries the sub-regions; the countries it draws
    // are assembled from those rows afterwards.
    regions: members ? [...members.values()].flat() : groups.map(({ uid }) => uid),
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
          const rows = resolved.get(referenceKey(reference)) ?? [];
          const points = members
            ? aggregateScoreboardData(rows, { scenario, regions: members.get(region) ?? [] })
            : selectScoreboardData(rows, { scenario, region });
          if (role === 'line' || role === 'rangeLow' || role === 'rangeHigh') return [role, points];
          return [role, points.find(({ year }) => year === selection.year)?.value ?? null];
        })
      )
    );
  const hasValues = (entries: ReturnType<typeof resolveSeries>) => {
    if (definition.chartType === 'bubble') return entries.some(({ x, y, size }) => Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(size) && Number(size) > 0);
    if (definition.chartType === 'scatter') return entries.some(({ x, y }) => Number.isFinite(x) && Number.isFinite(y));
    if (definition.chartType === 'box_plot') return entries.some(({ median }) => Number.isFinite(median));
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
