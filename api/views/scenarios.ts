import { createPlatform } from '../platform';
import {
  representativeVariable,
  composeVariable,
  indicatorsFromVariables,
  FACET_DEFAULTS,
  BASELINE_SCENARIO,
} from '../conventions';
import { dfToRows, yearColumns, type DataFrameLike, type WideRow } from '../tabulate';
import type { Ixmp4Instance } from '../types';

export interface ScenarioAvailability {
  uid: string;
  yearStart: number;
  yearStep: number;
  yearEnd: number;
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
export function scenarioAvailabilityFromRows(
  rows: WideRow[],
  opts: { exclude?: string[] } = {},
): ScenarioAvailability[] {
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
      uid: row.scenario,
      yearStart: years[0],
      yearStep: years.length > 1 ? years[1] - years[0] : 0,
      yearEnd: years[years.length - 1],
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
  },
): Promise<ScenarioAvailability[]> {
  const platform = await createPlatform(instance, creds.username, creds.password);

  if (params.axis === 'warmingLevel') {
    // Discover the indicator's warming levels from the naming convention, then
    // probe one representative level (all levels share the same scenario set).
    const variables = await platform.iamc.variables.list();
    const facets = indicatorsFromVariables(variables.map((v) => v.name)).find((f) => f.uid === params.indicator);
    const level = pickRepresentativeWarmingLevel(facets?.warmingLevels ?? []);
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
