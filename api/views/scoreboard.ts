import type { Platform } from '@iiasa/ixmp4-ts';
import { dfToRows, yearColumns, type DataFrameLike, type WideRow } from '../tabulate';

export interface ScoreboardVariableReference {
  variable: string;
  model?: string;
  unit?: string;
  unitFallback?: string;
  label?: string;
}

export interface ScoreboardSelection {
  scenario: string;
  region: string;
}

export interface ScoreboardScope {
  scenario?: string;
  regions: string[];
  year?: number;
}

export async function readDefaultRunSeries(platform: Pick<Platform, 'iamc'>, reference: ScoreboardVariableReference, scope: ScoreboardScope): Promise<WideRow[]> {
  if (!scope.regions.length) return [];
  const df = await platform.iamc.tabulate({
    variable: { name: reference.variable },
    ...(reference.model ? { model: { name: reference.model } } : {}),
    ...(reference.unit ? { unit: { name: reference.unit } } : {}),
    run: { defaultOnly: true },
    region: { name_in: scope.regions },
    ...(scope.scenario ? { scenario: { name: scope.scenario } } : {}),
    ...(scope.year !== undefined ? { stepYear: scope.year } : {}),
    wide: true,
  });
  return dfToRows(df as DataFrameLike);
}

export async function readScoreboardMapSeries(
  platform: Pick<Platform, 'iamc'>,
  variable: string,
  scope: Required<Pick<ScoreboardScope, 'scenario' | 'regions' | 'year'>>
): Promise<WideRow[]> {
  if (!scope.regions.length) return [];
  const df = await platform.iamc.tabulate({
    variable: { name: variable },
    run: { defaultOnly: true },
    scenario: { name: scope.scenario },
    region: { name_in: scope.regions },
    stepYear: scope.year,
    wide: true,
  });
  return dfToRows(df as DataFrameLike);
}

/**
 * One country's series, summed from the sub-regions it is made of.
 *
 * Some variables are published only at NUTS level, so a country total has to be
 * built rather than read. Summing is valid because the quantities that opt into
 * it are extensive — head counts, fatalities, losses — which is why a chart has
 * to declare `aggregate` rather than this being applied to whatever is grouped.
 *
 * A year is summed from the regions that reported it, so a country with one
 * silent region is understated rather than blank: the same treatment a stacked
 * bar already gives a missing segment. A year no region reported stays null, so
 * it reads as absent instead of as a true zero.
 */
export function aggregateScoreboardData(
  rows: WideRow[],
  selection: { scenario: string; regions: string[] }
): Array<{ year: number; value: number | null }> {
  const wanted = new Set(selection.regions);
  const matches = rows.filter((row) => row.scenario === selection.scenario && wanted.has(String(row.region)));
  if (!matches.length) return [];
  const totals = new Map<number, number | null>();
  for (const row of matches) {
    for (const year of yearColumns(row)) {
      const value = row[String(year)];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        if (!totals.has(year)) totals.set(year, null);
        continue;
      }
      totals.set(year, (totals.get(year) ?? 0) + value);
    }
  }
  return [...totals.entries()].sort(([a], [b]) => a - b).map(([year, value]) => ({ year, value }));
}

export function selectScoreboardData(rows: WideRow[], selection: ScoreboardSelection): Array<{ year: number; value: number | null }> {
  const matches = rows.filter((row) => row.scenario === selection.scenario && row.region === selection.region);
  if (matches.length > 1) throw new Error('Ambiguous default-run rows');
  if (matches.length === 0) return [];
  const row = matches[0];
  return yearColumns(row).map((year) => {
    const value = row[String(year)];
    return { year, value: typeof value === 'number' && Number.isFinite(value) ? value : null };
  });
}
