import type { WideRow } from '../tabulate';
import type { MapIndicator } from './types';

export function regionalMapResult(rows: WideRow[], definition: MapIndicator, scenario: string, year: number) {
  const values: Array<{ region: string; value: number }> = [];
  const regions = new Set<string>();
  for (const row of rows) {
    const value = row[String(year)];
    if (row.scenario !== scenario || typeof value !== 'number' || !Number.isFinite(value)) continue;
    const region = String(row.region);
    if (regions.has(region)) throw new Error('Ambiguous regional map rows');
    regions.add(region);
    values.push({ region, value });
  }
  const first = rows[0];
  const metadata = first
    ? { variable: String(first.variable), model: String(first.model), unit: String(first.unit) }
    : null;
  return { definition, status: values.length ? 'ready' : 'empty', values, metadata };
}
