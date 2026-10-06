import type { WideRow } from '../tabulate';
import type { MapIndicator } from './types';
import { SCOREBOARD_COUNTRIES } from './countries';

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

/**
 * A country-level map built from rows published at NUTS level.
 *
 * Only for indicators that declare `aggregate: "sum"`. Most mapped variables
 * carry country rows of their own and are simply queried for them, which also
 * keeps an intensive quantity — a temperature, a rate — out of a sum that would
 * be meaningless. A NUTS id opens with its country's code, the same code the
 * scoreboard lists countries by.
 */
export function aggregatedCountryMapResult(rows: WideRow[], definition: MapIndicator, scenario: string, year: number) {
  const totals = new Map<string, number>();
  let model: string | undefined;
  let unit: string | undefined;
  for (const row of rows) {
    const value = row[String(year)];
    if (row.scenario !== scenario || typeof value !== 'number' || !Number.isFinite(value)) continue;
    const code = String(row.region).slice(0, 2);
    const country = SCOREBOARD_COUNTRIES.find((entry) => entry.code === code);
    if (!country) continue;
    totals.set(country.name, (totals.get(country.name) ?? 0) + value);
    model ??= typeof row.model === 'string' ? row.model : undefined;
    unit ??= typeof row.unit === 'string' ? row.unit : undefined;
  }
  const values = [...totals].map(([region, value]) => ({ region, value }));
  const metadata = values.length ? { variable: String(rows[0]?.variable ?? ''), model: String(model ?? ''), unit: String(unit ?? '') } : null;
  return { definition, status: values.length ? 'ready' : 'empty', values, metadata };
}
