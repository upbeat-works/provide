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
