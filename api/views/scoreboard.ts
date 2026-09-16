import type { Platform } from '@iiasa/ixmp4-ts';
import { dfToRows, yearColumns, type DataFrameLike, type WideRow } from '../tabulate';

export interface ScoreboardVariableReference {
  variable: string;
  model: string;
  unit: string;
}

export interface ScoreboardSelection {
  scenario: string;
  region: string;
}

export async function readDefaultRunSeries(
  platform: Pick<Platform, 'iamc'>,
  reference: ScoreboardVariableReference,
): Promise<WideRow[]> {
  const df = await platform.iamc.tabulate({
    variable: { name: reference.variable },
    model: { name: reference.model },
    unit: { name: reference.unit },
    run: { defaultOnly: true },
    wide: true,
  });
  return dfToRows(df as DataFrameLike);
}

export function selectScoreboardData(
  rows: WideRow[],
  selection: ScoreboardSelection,
): Array<{ year: number; value: number | null }> {
  const matches = rows.filter((row) => row.scenario === selection.scenario && row.region === selection.region);
  if (matches.length > 1) throw new Error('Ambiguous default-run rows');
  if (matches.length === 0) return [];
  const row = matches[0];
  return yearColumns(row).map((year) => {
    const value = row[String(year)];
    return { year, value: typeof value === 'number' && Number.isFinite(value) ? value : null };
  });
}
