// Shared helpers for working with ixmp4-ts "wide" tabulate results, where each
// row is a (scenario, model, version) and the timeseries values live in
// year-named columns (e.g. "2020", "2025", …).

// The ixmp4-ts DataFrame is column/row-array based.
export interface DataFrameLike {
  columns: string[];
  values: unknown[][];
}

export interface WideRow {
  scenario: string;
  model?: string;
  unit?: unknown;
  [column: string]: unknown;
}

/** Turn a DataFrame into plain row objects keyed by column name. */
export const dfToRows = (df: DataFrameLike): WideRow[] =>
  df.values.map((row) => Object.fromEntries(df.columns.map((c, i) => [c, row[i]])) as WideRow);

/** The 4-digit year columns of a wide row, ascending. */
export const yearColumns = (row: WideRow): number[] =>
  Object.keys(row)
    .filter((k) => /^\d{4}$/.test(k))
    .map(Number)
    .sort((a, b) => a - b);
