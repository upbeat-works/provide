import type { Platform } from '@iiasa/ixmp4-ts';
import { createPlatform } from '../platform';
import { representativeVariable, composeVariable, indicatorsFromVariables, FACET_DEFAULTS, BASELINE_SCENARIO } from '../conventions';
import { dfToRows, yearColumns, type DataFrameLike, type WideRow } from '../tabulate';
import type { ScenarioDetailsResponse, ScenarioGmtBand } from '../catalog/contracts';
import type { Ixmp4Instance } from '../types';
import { fetchGmtScenario, fetchGmtSeriesStrict, type GmtByScenario } from './gmt';

export interface ScenarioAvailability {
  id: string;
  label: string;
  yearStart: number;
  yearEnd: number;
}

function publicGmtBand([min, value, max]: [number, number, number]): ScenarioGmtBand {
  const finiteOrNull = (entry: number) => (Number.isFinite(entry) ? entry : null);
  return [finiteOrNull(min), finiteOrNull(value), finiteOrNull(max)];
}

export function scenarioDetailsFromSources(instance: string, scenarioNames: string[], timeframes: Map<string, ScenarioTimeframe>, gmt: GmtByScenario): ScenarioDetailsResponse[] {
  const names = new Map<string, string>();
  for (const name of scenarioNames) {
    const key = name.toLowerCase();
    if (!names.has(key)) names.set(key, name);
  }
  for (const [key, series] of gmt) {
    if (!names.has(key)) names.set(key, series.scenario);
  }

  const details: ScenarioDetailsResponse[] = [];
  for (const [key, name] of names) {
    const series = gmt.get(key);
    let timeframe = timeframes.get(key);
    if (!timeframe && series) {
      timeframe = {
        yearStart: series.yearStart,
        yearStep: series.yearStep,
        yearEnd: series.yearEnd,
      };
    }
    if (!timeframe) continue;

    const response: ScenarioDetailsResponse = {
      id: name,
      label: name,
      instance,
      ...timeframe,
      characteristics: series?.characteristics ?? {},
    };
    if (series) {
      response.gmt = {
        data: series.data.map(publicGmtBand),
        yearStart: series.yearStart,
        yearStep: series.yearStep,
        yearEnd: series.yearEnd,
        ...(series.model ? { model: series.model } : {}),
        ...(series.unit ? { unit: series.unit } : {}),
      };
    }
    details.push(response);
  }
  return details;
}

async function fetchScenarioTimeframe(platform: Platform, scenario: string): Promise<ScenarioTimeframe | undefined> {
  const df = await platform.iamc.tabulate({ scenario: { name_ilike: scenario }, wide: true });
  return scenarioTimeframesFromRows(dfToRows(df as DataFrameLike)).get(scenario.toLowerCase());
}

export async function fetchScenarioDetail(instance: Ixmp4Instance, creds: { username: string; password: string }, requestedId: string): Promise<ScenarioDetailsResponse | null> {
  const platform = await createPlatform(instance, creds.username, creds.password);
  const [runs, timeframe, fetchedGmt] = await Promise.all([
    platform.runs.list({ scenario: { name_ilike: requestedId } }),
    fetchScenarioTimeframe(platform, requestedId),
    fetchGmtScenario(platform, requestedId),
  ]);
  const key = requestedId.toLowerCase();
  const scenarioNames = runs.map((run) => run.scenario.name).filter((name) => name.toLowerCase() === key);
  const gmt = new Map([...fetchedGmt].filter(([scenarioKey]) => scenarioKey === key));
  const timeframes = new Map<string, ScenarioTimeframe>();
  if (timeframe) timeframes.set(key, timeframe);
  return scenarioDetailsFromSources(instance.slug, scenarioNames, timeframes, gmt)[0] ?? null;
}

export async function fetchMethodologyScenarioDetails(instance: Ixmp4Instance, creds: { username: string; password: string }): Promise<ScenarioDetailsResponse[]> {
  const platform = await createPlatform(instance, creds.username, creds.password);
  const [runs, gmt] = await Promise.all([platform.runs.list(), fetchGmtSeriesStrict(platform)]);
  const gmtModel = [...gmt.values()][0]?.model;
  const names = new Map<string, string>();
  for (const run of runs) {
    if (gmtModel && run.model.name === gmtModel) continue;
    const name = run.scenario.name;
    const key = name.toLowerCase();
    if (!names.has(key)) names.set(key, name);
  }
  const scenarioNames = [...names.values()];
  const scenarioKeys = new Set(names.keys());
  const scenarioGmt = new Map([...gmt].filter(([key]) => scenarioKeys.has(key)));
  return scenarioDetailsFromSources(instance.slug, scenarioNames, new Map(), scenarioGmt);
}

// Which value axis to probe availability against. The percentile axis is the
// default (impact-time/explore plots percentile bands); the avoid view plots the
// warming-level axis, whose scenario coverage can differ, so it probes there.
export type ScenarioAxis = 'percentile' | 'warmingLevel';

/**
 * Pick a representative warming level to probe scenario availability against.
 * Any warming level of an indicator carries the same scenario set, so one probe
 * suffices; the middle of the (numerically-sorted) levels is used, mirroring the
 * unavoidable-risk default-threshold heuristic. Expects levels sorted ascending
 * (as `indicatorsFromVariables` returns them). Pure.
 */
export function pickRepresentativeWarmingLevel(levels: string[]): string | undefined {
  if (!levels.length) return undefined;
  return levels[Math.floor((levels.length - 1) / 2)];
}

/**
 * Per-scenario availability + timeframe from the wide tabulate of one faceted
 * variable: each row is a scenario, its year span is the columns that hold a
 * finite value. Scenarios with no data are dropped; the first row per scenario
 * wins (default run). `exclude` drops named scenarios (case-insensitive) — the
 * avoid view uses it to keep the `Today` baseline out of the selectable set.
 * Pure.
 */
export function scenarioAvailabilityFromRows(rows: WideRow[], opts: { exclude?: string[] } = {}): ScenarioAvailability[] {
  // Dedup case-insensitively: a scenario uploaded under two casings (the
  // `SSP5-3.4-OS`/`SSP5-3.4-Os` source duplicate) is one availability entry.
  const excluded = new Set((opts.exclude ?? []).map((s) => s.toLowerCase()));
  const seen = new Set<string>();
  const out: ScenarioAvailability[] = [];
  for (const row of rows) {
    if (excluded.has(row.scenario.toLowerCase())) continue;
    if (seen.has(row.scenario.toLowerCase())) continue;
    const years = yearColumns(row).filter((y) => {
      const v = row[String(y)];
      return v != null && Number.isFinite(Number(v));
    });
    if (!years.length) continue;
    seen.add(row.scenario.toLowerCase());
    out.push({
      id: row.scenario,
      label: row.scenario,
      yearStart: years[0],
      yearEnd: years[years.length - 1],
    });
  }
  return out;
}

export interface ScenarioTimeframe {
  yearStart: number;
  yearStep: number;
  yearEnd: number;
}

/**
 * Scenario-intrinsic timeframes: the union of every row's year span, keyed by
 * lowercased scenario name. Unlike `scenarioAvailabilityFromRows` (one region,
 * first row wins) this is fed rows spanning many regions and both value axes, so
 * a scenario's span is the widest one it has anywhere. Merging case-insensitively
 * also reunites the case-only duplicate runs, whose two axes are split across the
 * two casings. Pure.
 */
export function scenarioTimeframesFromRows(rows: WideRow[]): Map<string, ScenarioTimeframe> {
  const years = new Map<string, Set<number>>();
  for (const row of rows) {
    const finite = yearColumns(row).filter((y) => {
      const v = row[String(y)];
      return v != null && Number.isFinite(Number(v));
    });
    if (!finite.length) continue;
    const key = row.scenario.toLowerCase();
    let set = years.get(key);
    if (!set) years.set(key, (set = new Set()));
    for (const y of finite) set.add(y);
  }

  const out = new Map<string, ScenarioTimeframe>();
  for (const [key, set] of years) {
    const sorted = [...set].sort((a, b) => a - b);
    const gaps = sorted.slice(1).map((y, i) => y - sorted[i]);
    out.set(key, {
      yearStart: sorted[0],
      yearStep: gaps.length ? Math.min(...gaps) : 0,
      yearEnd: sorted[sorted.length - 1],
    });
  }
  return out;
}

/**
 * The scenarios that have data for an indicator in a region, with each one's
 * timeframe — for the fully-faceted variable of the current parameter selection.
 *
 * `axis` picks which value segment to probe: `percentile` (default) tests the
 * `50th Percentile` representative variable — correct for the percentile-band
 * charts (impact-time/explore). `warmingLevel` tests a representative warming
 * level instead — correct for the unavoidable-risk chart, whose scenarios live
 * on that axis (which can cover a different scenario set) — and drops the `Today`
 * baseline, which is a present-day reference, not a selectable projection.
 */
export async function fetchScenarioAvailability(
  instance: Ixmp4Instance,
  creds: { username: string; password: string },
  params: {
    indicator: string;
    region: string;
    period?: string;
    temporal?: string;
    spatial?: string;
    axis?: ScenarioAxis;
  }
): Promise<ScenarioAvailability[] | null> {
  const platform = await createPlatform(instance, creds.username, creds.password);
  const variables = await platform.iamc.variables.list({ name_ilike: `${params.indicator}|*` });
  const facets = indicatorsFromVariables(variables.map((variable) => variable.name)).find((facet) => facet.uid === params.indicator);
  if (!facets) return null;

  if (params.axis === 'warmingLevel') {
    // Discover the indicator's warming levels from the naming convention, then
    // probe one representative level (all levels share the same scenario set).
    const level = pickRepresentativeWarmingLevel(facets.warmingLevels);
    if (!level) return [];
    const name = composeVariable({
      indicator: params.indicator,
      period: params.period ?? FACET_DEFAULTS.period,
      temporal: params.temporal ?? FACET_DEFAULTS.temporal,
      spatial: params.spatial ?? FACET_DEFAULTS.spatial,
      value: level,
    });
    const df = await platform.iamc.tabulate({ region: { name: params.region }, variable: { name }, wide: true });
    return scenarioAvailabilityFromRows(dfToRows(df as DataFrameLike), { exclude: [BASELINE_SCENARIO] });
  }

  const name = representativeVariable(params.indicator, params);
  const df = await platform.iamc.tabulate({ region: { name: params.region }, variable: { name }, wide: true });
  return scenarioAvailabilityFromRows(dfToRows(df as DataFrameLike));
}
