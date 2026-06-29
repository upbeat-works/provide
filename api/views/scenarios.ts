import { createPlatform } from '../platform';
import { representativeVariable } from '../conventions';
import { dfToRows, yearColumns, type DataFrameLike, type WideRow } from '../tabulate';
import type { Ixmp4Instance } from '../types';

export interface ScenarioAvailability {
  uid: string;
  yearStart: number;
  yearStep: number;
  yearEnd: number;
}

/**
 * Per-scenario availability + timeframe from the wide tabulate of one faceted
 * variable: each row is a scenario, its year span is the columns that hold a
 * finite value. Scenarios with no data are dropped; the first row per scenario
 * wins (default run). Pure.
 */
export function scenarioAvailabilityFromRows(rows: WideRow[]): ScenarioAvailability[] {
  const seen = new Set<string>();
  const out: ScenarioAvailability[] = [];
  for (const row of rows) {
    if (seen.has(row.scenario)) continue;
    const years = yearColumns(row).filter((y) => {
      const v = row[String(y)];
      return v != null && Number.isFinite(Number(v));
    });
    if (!years.length) continue;
    seen.add(row.scenario);
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
 */
export async function fetchScenarioAvailability(
  instance: Ixmp4Instance,
  creds: { username: string; password: string },
  params: { indicator: string; region: string; period?: string; temporal?: string; spatial?: string },
): Promise<ScenarioAvailability[]> {
  const platform = await createPlatform(instance, creds.username, creds.password);
  const name = representativeVariable(params.indicator, params);
  const df = await platform.iamc.tabulate({ region: { name: params.region }, variable: { name }, wide: true });
  return scenarioAvailabilityFromRows(dfToRows(df as DataFrameLike));
}
