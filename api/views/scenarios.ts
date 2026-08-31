import { createPlatform } from '../platform';
import {
  representativeVariable,
  composeVariable,
  indicatorsFromVariables,
  FACET_DEFAULTS,
  BASELINE_SCENARIO,
  REPRESENTATIVE_VALUE,
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
 * Every catalog scenario's intrinsic timeframe, for the scenario list on the
 * methodology page (which is about scenarios in general, not one indicator in one
 * region — so unlike `/scenarios` it takes no indicator/region).
 *
 * Probes BOTH value axes, because their scenario coverage differs sharply: today
 * the percentile axis carries 2 scenarios and the warming-level axis 11. Walks
 * indicators only until every scenario is accounted for, so the common case is
 * two tabulates. Region is left unfiltered — a scenario's span is the widest it
 * has anywhere.
 */
export async function fetchScenarioTimeframes(
  platforms: Array<{ platform: { iamc: { tabulate: (q: unknown) => Promise<unknown> } } }>,
  facets: Array<{ uid: string; periods: string[]; temporals: string[]; spatials: string[]; percentiles: string[]; warmingLevels: string[] }>,
  scenarioNames: string[],
): Promise<Map<string, ScenarioTimeframe>> {
  const pending = new Set(scenarioNames.map((s) => s.toLowerCase()));
  const rows: WideRow[] = [];

  for (const { platform } of platforms) {
    for (const facet of facets) {
      if (!pending.size) break;
      const base = {
        indicator: facet.uid,
        period: facet.periods[0] ?? FACET_DEFAULTS.period,
        temporal: facet.temporals[0] ?? FACET_DEFAULTS.temporal,
        spatial: facet.spatials[0] ?? FACET_DEFAULTS.spatial,
      };
      const level = pickRepresentativeWarmingLevel(facet.warmingLevels);
      const values = [facet.percentiles.length ? REPRESENTATIVE_VALUE : undefined, level].filter(Boolean) as string[];

      for (const value of values) {
        // One bad variable must not sink the whole catalog.
        try {
          const df = await platform.iamc.tabulate({ variable: { name: composeVariable({ ...base, value }) }, wide: true });
          const fetched = dfToRows(df as DataFrameLike);
          rows.push(...fetched);
          for (const row of fetched) pending.delete(row.scenario.toLowerCase());
        } catch {
          /* skip this probe */
        }
      }
    }
  }
  return scenarioTimeframesFromRows(rows);
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
