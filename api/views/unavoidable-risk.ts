import { createPlatform } from '../platform';
import { composeVariable, indicatorsFromVariables, FACET_DEFAULTS } from '../conventions';
import { dfToRows, yearColumns, type DataFrameLike, type WideRow } from '../tabulate';
import type { Ixmp4Instance } from '../types';

export interface EnsembleParams {
  indicator: string;
  geography: string;
  scenarios: string[];
  period?: string;
  temporal?: string;
  spatial?: string;
}

export interface EnsembleResponse {
  thresholds: number[];
  defaultThreshold: number;
  years: number[];
  today: number[];
  data: Record<string, number[][]>;
  title: string;
  description: string;
  model: string;
  source: string;
  formats: string[];
}

// The present-day baseline is carried as its own scenario in ixmp4 (the same
// "Today" run impact-time uses); its exceedance probabilities become the
// response's `today` array — never a projected line in `data`.
export const TODAY_SCENARIO = 'Today';

// The wide tabulate rows of one threshold's variable (one warming level), plus
// that level as a number so thresholds can be ordered/emitted numerically.
export interface ThresholdRows {
  threshold: number;
  rows: WideRow[];
}

export interface AssembleEnsembleInput {
  indicator: string;
  thresholdRows: ThresholdRows[];
  scenarios: string[];
  todayScenario?: string;
  model?: string;
  source?: string;
  defaultThreshold?: number;
}

/**
 * Interim default threshold: the middle of the sorted set. The legacy per-
 * indicator defaults were curated (temperature → 2, biodiversity → 0.5); until a
 * curation registry lands this keeps the endpoint convention-driven. Pure.
 */
export function pickDefaultThreshold(thresholds: number[]): number {
  if (!thresholds.length) return 0;
  return thresholds[Math.floor((thresholds.length - 1) / 2)];
}

/**
 * Assemble the unavoidable-risk (ensemble exceedance) response from one wide
 * tabulate per threshold. For each requested scenario, produce a `[threshold]
 * [year]` matrix of exceedance probabilities (the shape the chart reads as
 * `data[scenario][thresholdIndex][yearIndex]`); the `Today` baseline scenario
 * becomes the per-threshold `today` array instead of a line. Pure — no ixmp4.
 */
export function assembleEnsemble(input: AssembleEnsembleInput): EnsembleResponse {
  const { indicator, scenarios, todayScenario = TODAY_SCENARIO } = input;
  // Thresholds ascending; each carries its wide rows keyed by LOWERCASE scenario
  // for O(1), case-insensitive lookup while stacking. Case-folding guards against
  // source duplicates whose only difference is casing (the `SSP5-3.4-OS`/`Os`
  // pair whose data is split across the two runs); output is keyed by the
  // requested (canonical) name so the frontend finds it.
  const levels = [...input.thresholdRows].sort((a, b) => a.threshold - b.threshold);
  const thresholds = levels.map((l) => l.threshold);
  const rowsByLevel = levels.map((l) => {
    const byScenario = new Map<string, WideRow>();
    for (const row of l.rows) {
      const key = row.scenario.toLowerCase();
      if (!byScenario.has(key)) byScenario.set(key, row);
    }
    return byScenario;
  });

  // Year axis = the union of years the REQUESTED scenarios have DATA for,
  // ascending. Only years with a finite value count — a column that's null for
  // every requested scenario/threshold (e.g. a leading empty 2000) is dropped
  // rather than carried as an all-null slot. The Today baseline is excluded so
  // its (present-day) year can't shift the projection axis.
  const requested = new Set(scenarios.map((s) => s.toLowerCase()));
  const yearSet = new Set<number>();
  for (const level of levels) {
    for (const row of level.rows) {
      if (!requested.has(row.scenario.toLowerCase())) continue;
      for (const y of yearColumns(row)) {
        const v = row[String(y)];
        if (v != null && Number.isFinite(Number(v))) yearSet.add(y);
      }
    }
  }
  const years = [...yearSet].sort((a, b) => a - b);

  // A scenario's per-year values for one threshold, NaN where a cell is missing.
  const seriesFor = (row: WideRow | undefined): number[] =>
    years.map((y) => {
      const v = row?.[String(y)];
      return v == null ? NaN : Number(v);
    });

  // data[scenario] = [threshold][year]. Include a requested scenario only if it
  // appears for at least one threshold (mirrors impact-time dropping empties).
  const data: Record<string, number[][]> = {};
  for (const scenario of scenarios) {
    const key = scenario.toLowerCase();
    if (!rowsByLevel.some((m) => m.has(key))) continue;
    data[scenario] = rowsByLevel.map((m) => seriesFor(m.get(key)));
  }

  // today = one value per threshold, the Today baseline's earliest finite value.
  const todayKey = todayScenario.toLowerCase();
  const today = rowsByLevel.map((m) => {
    const row = m.get(todayKey);
    if (!row) return NaN;
    for (const y of yearColumns(row)) {
      const v = row[String(y)];
      if (v != null && Number.isFinite(Number(v))) return Number(v);
    }
    return NaN;
  });

  return {
    thresholds,
    defaultThreshold: input.defaultThreshold ?? pickDefaultThreshold(thresholds),
    years,
    today,
    data,
    title: indicator,
    description: '',
    model: input.model ?? '',
    source: input.source ?? '',
    formats: [],
  };
}

/** Warming-level segment ("1.5 °C") → its numeric value. Non-numeric → NaN. */
function parseWarmingLevel(raw: string): number {
  const m = raw.match(/^(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : NaN;
}

/**
 * The unavoidable-risk view: probability of crossing each warming threshold over
 * time. Discovers the indicator's thresholds from its warming-level variables
 * (no curation), tabulates one series per threshold at the chart's region, and
 * assembles the legacy ensemble shape. Period/temporal/spatial default to
 * Present Day · Annual · Area, matching impact-time.
 */
export async function fetchEnsemble(
  instance: Ixmp4Instance,
  creds: { username: string; password: string },
  params: EnsembleParams,
): Promise<EnsembleResponse> {
  const platform = await createPlatform(instance, creds.username, creds.password);
  const base = {
    indicator: params.indicator,
    period: params.period ?? FACET_DEFAULTS.period,
    temporal: params.temporal ?? FACET_DEFAULTS.temporal,
    spatial: params.spatial ?? FACET_DEFAULTS.spatial,
  };

  // Discover the exceedance thresholds for this indicator: the warming-level
  // value segments present on its variables, derived from the naming convention.
  const variables = await platform.iamc.variables.list();
  const facets = indicatorsFromVariables(variables.map((v) => v.name)).find((f) => f.uid === params.indicator);
  const levels = (facets?.warmingLevels ?? [])
    .map((raw) => ({ raw, threshold: parseWarmingLevel(raw) }))
    .filter((l) => Number.isFinite(l.threshold));

  // One wide tabulate per threshold (each returns all scenarios, incl. Today).
  const dfs = await Promise.all(
    levels.map((l) =>
      platform.iamc.tabulate({
        region: { name: params.geography },
        variable: { name: composeVariable({ ...base, value: l.raw }) },
        wide: true,
      }),
    ),
  );

  let model: string | undefined;
  const thresholdRows: ThresholdRows[] = levels.map((l, i) => {
    const rows = dfToRows(dfs[i] as DataFrameLike);
    for (const row of rows) model ??= row.model;
    return { threshold: l.threshold, rows };
  });

  return assembleEnsemble({
    indicator: params.indicator,
    thresholdRows,
    scenarios: params.scenarios,
    todayScenario: TODAY_SCENARIO,
    model,
    source: instance.slug,
  });
}
