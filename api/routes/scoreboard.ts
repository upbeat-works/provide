import { Hono } from 'hono';
import type { Env } from '../types';
import { instances } from '../instances';
import { createPlatform } from '../platform';
import { readDefaultRunSeries, selectScoreboardData, type ScoreboardVariableReference } from '../views/scoreboard';
import { getScoreboard, SCOREBOARD_INSTANCE } from '../scoreboard/controller.js';
import { loadAdmin0Geographies, loadChildRegions, loadMapMembers, loadMapRegionOptions, loadSupportedAreas } from '../scoreboard/regions';
import { countryMapValues, r9MapValues } from '../scoreboard/maps';

type Definition = {
  chartId: string;
  chartType: string;
  data: { series: Array<Record<string, ScoreboardVariableReference>>; groupBy?: string };
  [key: string]: unknown;
};
type Option = { uid: string; label: string };
type MapDefinition = { title: string; geographyType: 'admin0' | 'r9'; data: ScoreboardVariableReference };
type RowsResult = { rows?: Awaited<ReturnType<typeof readDefaultRunSeries>>; error?: string };

const scoreboard = new Hono<Env>();
const option = (uid: string): Option => ({ uid, label: uid });
const referenceKey = ({ variable, model, unit }: ScoreboardVariableReference) => JSON.stringify([variable, model, unit]);

function safeFailure(reason: unknown): Record<string, unknown> {
  if (!(reason instanceof Error)) return { reasonType: typeof reason };
  const failure: Record<string, unknown> = { reasonName: reason.name };
  if ('code' in reason && typeof reason.code === 'string') failure.reasonCode = reason.code;
  if ('status' in reason && typeof reason.status === 'number') failure.reasonStatus = reason.status;
  if (reason.cause instanceof Error) {
    failure.causeName = reason.cause.name;
    if ('code' in reason.cause && typeof reason.cause.code === 'string') failure.causeCode = reason.cause.code;
  }
  if ('response' in reason && reason.response && typeof reason.response === 'object' && 'status' in reason.response && typeof reason.response.status === 'number') {
    failure.reasonStatus = reason.response.status;
  }
  return failure;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function definitionGroupingError(definition: Definition): string | null {
  const groupBy = definition.data.groupBy;
  if (groupBy === undefined) return null;
  if (groupBy !== 'region' && groupBy !== 'scenario') return 'Unsupported chart grouping';
  if (definition.chartType !== 'stacked_bar' && definition.chartType !== 'bubble') return 'Unsupported chart grouping';
  return null;
}

function worldR9RegionsAvailable(regions: Set<string>): boolean {
  return ['China (R9)', 'European Union (R9)', 'India (R9)', 'Latin America (R9)', 'Middle East & Africa (R9)', 'Other Asia (R9)', 'Other OECD (R9)', 'Reforming Economies (R9)', 'USA (R9)'].some((region) => regions.has(region));
}

function valueAtYear(points: Array<{ year: number; value: number | null }>, year: number | null): number | null {
  if (year === null) return null;
  return points.find((point) => point.year === year)?.value ?? null;
}

scoreboard.get('/', async (c) => {
  const selectedScoreboard = getScoreboard(c.req.query('sector'));
  let definitions = selectedScoreboard.definitions as Definition[];
  let mapDefinition = selectedScoreboard.mapDefinition as MapDefinition | undefined;
  const chartId = c.req.query('chartId');
  if (chartId) {
    definitions = definitions.filter((definition) => definition.chartId === chartId);
    mapDefinition = undefined;
  }
  if (definitions.length === 0 && !mapDefinition) {
    return c.json({
      scenarios: [],
      regions: [],
      years: [],
      selection: { scenario: null, region: null, year: null },
      charts: [],
    });
  }

  const validDefinitions = definitions.filter((definition) => !definitionGroupingError(definition));
  const instance = instances.find(({ slug }) => slug === SCOREBOARD_INSTANCE);
  if (!instance) return c.json({ error: 'Scoreboard source unavailable' }, 500);

  let platform;
  try {
    platform = await createPlatform(instance, c.env.IXMP4_USERNAME, c.env.IXMP4_PASSWORD);
  } catch (reason) {
    console.error('Scoreboard source connection failed', {
      operation: 'connect-scoreboard-source',
      sector: selectedScoreboard.sector.uid,
      chartId,
      scenario: c.req.query('scenario'),
      region: c.req.query('region'),
      year: c.req.query('year'),
      ...safeFailure(reason),
    });
    return c.json({ error: 'Scoreboard source unavailable' }, 502);
  }
  const reads = new Map<string, Promise<RowsResult>>();
  for (const definition of validDefinitions) {
    for (const entry of definition.data.series) {
      for (const reference of Object.values(entry)) {
        const key = referenceKey(reference);
        if (!reads.has(key)) {
          reads.set(key, readDefaultRunSeries(platform, reference)
            .then((rows) => ({ rows }))
            .catch((reason) => {
              console.error('Scoreboard variable read failed', {
                operation: 'read-default-run-series',
                sector: selectedScoreboard.sector.uid,
                chartId,
                scenario: c.req.query('scenario'),
                region: c.req.query('region'),
                year: c.req.query('year'),
                variable: reference.variable,
                model: reference.model,
                unit: reference.unit,
                ...safeFailure(reason),
              });
              return { error: 'Chart data unavailable' };
            }));
        }
      }
    }
  }
  if (mapDefinition) {
    const reference = mapDefinition.data;
    const key = referenceKey(reference);
    if (!reads.has(key)) {
      reads.set(key, readDefaultRunSeries(platform, reference)
        .then((rows) => ({ rows }))
        .catch((reason) => {
          console.error('Scoreboard map read failed', {
            operation: 'read-scoreboard-map', sector: selectedScoreboard.sector.uid,
            variable: reference.variable, model: reference.model, unit: reference.unit,
            ...safeFailure(reason),
          });
          return { error: 'Map data unavailable' };
        }));
    }
  }

  const resolvedEntries = await Promise.all([...reads].map(async ([key, pending]) => [key, await pending] as const));
  const resolved = new Map<string, RowsResult>(resolvedEntries);
  const rows = [...resolved.values()].flatMap((result) => result.rows ?? []);
  const scenarios = uniqueSorted(rows.map((row) => String(row.scenario)));
  const requestedScenario = c.req.query('scenario');
  let scenario = requestedScenario && scenarios.includes(requestedScenario) ? requestedScenario : null;
  if (!scenario) {
    const usesRegionGroups = definitions.some(({ data }) => data.groupBy === 'region');
    let preferredRegion: string | null = null;
    if (usesRegionGroups && rows.some((row) => row.region === 'World')) preferredRegion = 'World';
    else if (rows.some((row) => row.region === 'European Union (R9)')) preferredRegion = 'European Union (R9)';
    scenario = scenarios.reduce<string | null>((best, candidate) => {
      if (!preferredRegion) return best ?? candidate;
      const coverage = [...resolved.values()].filter(({ rows: referenceRows }) => referenceRows?.some((row) => row.scenario === candidate && row.region === preferredRegion)).length;
      if (!best) return candidate;
      const bestCoverage = [...resolved.values()].filter(({ rows: referenceRows }) => referenceRows?.some((row) => row.scenario === best && row.region === preferredRegion)).length;
      return coverage > bestCoverage ? candidate : best;
    }, null);
  }

  const scenarioRows = scenario ? rows.filter((row) => row.scenario === scenario) : [];
  const usesScenarioGroups = definitions.some(({ data }) => data.groupBy === 'scenario');
  const optionRows = usesScenarioGroups ? rows : scenarioRows;
  const chartReferenceKeys = new Set(validDefinitions.flatMap(({ data }) =>
    data.series.flatMap((entry) => Object.values(entry).map(referenceKey))));
  const chartRows = [...resolved.entries()]
    .filter(([key]) => chartReferenceKeys.has(key))
    .flatMap(([, result]) => result.rows ?? []);
  const chartOptionRows = usesScenarioGroups ? chartRows : chartRows.filter((row) => row.scenario === scenario);
  let regionValues = uniqueSorted(chartOptionRows.map((row) => String(row.region)));
  const regionLabels = new Map(regionValues.map((uid) => [uid, uid]));
  const groupedReferences = validDefinitions
    .filter(({ data }) => data.groupBy === 'region')
    .flatMap(({ data }) => data.series.flatMap((entry) => Object.values(entry)));
  if (groupedReferences.length) {
    const available = new Set(regionValues.filter((candidate) => groupedReferences.every((reference) => {
      const referenceRows = resolved.get(referenceKey(reference))?.rows ?? [];
      return referenceRows.some((row) => row.scenario === scenario && row.region === candidate && Object.entries(row).some(([key, value]) => /^\d{4}$/.test(key) && typeof value === 'number' && Number.isFinite(value)));
    })));
    try {
      const areas = await loadSupportedAreas(c.env.DB, available);
      for (const area of areas) regionLabels.set(area.uid, area.label);
      regionValues = uniqueSorted([...regionValues, ...areas.map(({ uid }) => uid)]);
    } catch {
      if (worldR9RegionsAvailable(available)) regionValues = uniqueSorted([...regionValues, 'World']);
    }
  }
  if (mapDefinition && scenario) {
    const mapRows = resolved.get(referenceKey(mapDefinition.data))?.rows ?? [];
    const available = new Set(mapRows.filter((row) => row.scenario === scenario && Object.entries(row).some(([key, value]) => /^\d{4}$/.test(key) && typeof value === 'number' && Number.isFinite(value))).map((row) => String(row.region)));
    try {
      const mapOptions = await loadMapRegionOptions(c.env.DB, mapDefinition.geographyType, available);
      for (const mapOption of mapOptions) regionLabels.set(mapOption.uid, mapOption.label);
      regionValues = uniqueSorted([...regionValues, ...mapOptions.map(({ uid }) => uid)]);
    } catch (reason) {
      console.error('Scoreboard map regions failed', { operation: 'resolve-map-regions', sector: selectedScoreboard.sector.uid, ...safeFailure(reason) });
    }
  }
  const requestedRegion = c.req.query('region');
  let region = requestedRegion && regionValues.includes(requestedRegion) ? requestedRegion : null;
  if (!region) {
    const usesRegionGroups = definitions.some(({ data }) => data.groupBy === 'region');
    const europe = regionValues.find((uid) => regionLabels.get(uid) === 'Europe');
    if (mapDefinition?.geographyType === 'admin0' && europe) region = europe;
    else if ((usesRegionGroups || mapDefinition?.geographyType === 'r9') && regionValues.includes('World')) region = 'World';
    else region = regionValues.includes('European Union (R9)') ? 'European Union (R9)' : regionValues[0] ?? null;
  }

  let selectionRegionIds = region ? [region] : [];
  if (region && definitions.some(({ data }) => data.groupBy === 'region')) {
    try {
      const children = await loadChildRegions(c.env.DB, region);
      if (children.length) selectionRegionIds = children.map(({ uid }) => uid);
    } catch {
      selectionRegionIds = [region];
    }
  }
  if (region && mapDefinition) {
    try {
      const members = await loadMapMembers(c.env.DB, mapDefinition.geographyType, region);
      if (members.length) selectionRegionIds = uniqueSorted([...selectionRegionIds, ...members.map(({ uid }) => uid)]);
    } catch (reason) {
      console.error('Scoreboard map area failed', { operation: 'resolve-map-area', sector: selectedScoreboard.sector.uid, region, ...safeFailure(reason) });
    }
  }
  const selectionRows = optionRows.filter((row) => selectionRegionIds.includes(String(row.region)));
  const yearValues = uniqueSorted(selectionRows.flatMap((row) => Object.keys(row).filter((key) => /^\d{4}$/.test(key) && typeof row[key] === 'number' && Number.isFinite(row[key])))).sort();
  const requestedYear = c.req.query('year');
  let year = requestedYear && yearValues.includes(requestedYear) ? requestedYear : null;
  if (!year) year = yearValues.includes('2050') ? '2050' : yearValues[0] ?? null;

  let map;
  if (mapDefinition) {
    const mapResult = resolved.get(referenceKey(mapDefinition.data));
    if (mapResult?.error) map = { definition: mapDefinition, status: 'error', values: [], error: mapResult.error };
    else {
      try {
        const members = region ? await loadMapMembers(c.env.DB, mapDefinition.geographyType, region) : [];
        const included = new Set(members.map(({ uid }) => uid));
        const mapRows = mapResult?.rows ?? [];
        let values = [];
        if (scenario && year && mapDefinition.geographyType === 'r9') values = r9MapValues(mapRows, scenario, Number(year), included);
        if (scenario && year && mapDefinition.geographyType === 'admin0') {
          const geographies = await loadAdmin0Geographies(c.env.DB);
          values = countryMapValues(mapRows, geographies, scenario, Number(year), included);
        }
        map = { definition: mapDefinition, status: values.length ? 'ready' : 'empty', values };
      } catch (reason) {
        console.error('Scoreboard map processing failed', { operation: 'process-map-data', sector: selectedScoreboard.sector.uid, scenario, region, year, ...safeFailure(reason) });
        map = { definition: mapDefinition, status: 'error', values: [], error: 'Map data unavailable' };
      }
    }
  }

  const charts = await Promise.all(definitions.map(async (definition) => {
    const { groupBy, series } = definition.data;
    const groupingError = definitionGroupingError(definition);
    if (groupingError) return { definition, status: 'error', data: [], error: groupingError };
    const references = series.flatMap((entry) => Object.values(entry));
    const failed = references.map((reference) => resolved.get(referenceKey(reference))).find((result) => result?.error);
    if (failed?.error) return { definition, status: 'error', data: [], error: failed.error };

    const resolveSeries = (targetRegion: string) => series.map((entry) => Object.fromEntries(Object.entries(entry).map(([role, reference]) => {
      const referenceRows = resolved.get(referenceKey(reference))?.rows ?? [];
      const points = scenario ? selectScoreboardData(referenceRows, { scenario, region: targetRegion }) : [];
      if (role === 'line' || role === 'rangeLow' || role === 'rangeHigh') return [role, points];
      return [role, valueAtYear(points, year ? Number(year) : null)];
    })));

    try {
      if (groupBy === 'scenario') {
        const data = scenarios.flatMap((candidate) => {
          if (!region) return [];
          const resolvedSeries = series.map((entry) => Object.fromEntries(Object.entries(entry).map(([role, reference]) => {
            const referenceRows = resolved.get(referenceKey(reference))?.rows ?? [];
            const points = selectScoreboardData(referenceRows, { scenario: candidate, region });
            return [role, valueAtYear(points, year ? Number(year) : null)];
          })));
          if (definition.chartType === 'bubble') {
            const hasCompleteSeries = resolvedSeries.some(({ x, y, size }) => Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(size) && Number(size) > 0);
            return hasCompleteSeries ? [{ scenario: option(candidate), series: resolvedSeries }] : [];
          }
          const complete = resolvedSeries.every((entry) => Object.values(entry).every((value) => typeof value === 'number' && Number.isFinite(value)));
          return complete ? [{ scenario: option(candidate), series: resolvedSeries }] : [];
        });
        return { definition, status: data.length ? 'ready' : 'empty', data };
      }

      if (groupBy === 'region') {
        const children = region ? await loadChildRegions(c.env.DB, region) : [];
        const data = children.flatMap((child) => {
          const resolvedSeries = resolveSeries(child.uid);
          if (definition.chartType === 'bubble') {
            const hasCompleteSeries = resolvedSeries.some(({ x, y, size }) => Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(size) && Number(size) > 0);
            return hasCompleteSeries ? [{ region: child, series: resolvedSeries }] : [];
          }
          const complete = resolvedSeries.every((entry) => Object.values(entry).every((value) => typeof value === 'number' && Number.isFinite(value)));
          return complete ? [{ region: child, series: resolvedSeries }] : [];
        });
        return { definition, status: data.length ? 'ready' : 'empty', data };
      }

      const data = region ? resolveSeries(region) : [];
      const hasValue = data.some((entry) => Object.values(entry).some((value) => {
        if (typeof value === 'number') return true;
        if (!Array.isArray(value)) return false;
        return value.some((point) => point.value !== null);
      }));
      return { definition, status: hasValue ? 'ready' : 'empty', data };
    } catch (reason) {
      console.error('Scoreboard chart processing failed', {
        operation: 'process-chart-data',
        sector: selectedScoreboard.sector.uid,
        chartId: definition.chartId,
        scenario,
        region,
        year,
        ...safeFailure(reason),
      });
      return { definition, status: 'error', data: [], error: 'Chart data unavailable' };
    }
  }));

  return c.json({
    scenarios: scenarios.map(option),
    regions: regionValues.map((uid) => ({ uid, label: regionLabels.get(uid) ?? uid })),
    years: yearValues.map(option),
    selection: {
      scenario: scenario ? option(scenario) : null,
      region: region ? { uid: region, label: regionLabels.get(region) ?? region } : null,
      year: year ? option(year) : null,
    },
    ...(map ? { map } : {}),
    charts,
  });
});

export { scoreboard };
