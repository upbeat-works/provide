import type { WideRow } from '../tabulate';
import { WORLD_R9 } from './regions';

type Geography = { id: string; label: string; geographyType: string; geoId: string | null };
type MapValue = { uid: string; label: string; value: number };

function valuesByRegion(rows: WideRow[], scenario: string, year: number): Map<string, number> {
  const values = new Map<string, number>();
  for (const row of rows) {
    if (row.scenario !== scenario || typeof row[String(year)] !== 'number' || !Number.isFinite(row[String(year)])) continue;
    const region = String(row.region);
    if (values.has(region)) throw new Error('Ambiguous default-run map rows');
    values.set(region, Number(row[String(year)]));
  }
  return values;
}

export function countryMapValues(rows: WideRow[], geographies: Geography[], scenario: string, year: number, included: Set<string>): MapValue[] {
  const values = valuesByRegion(rows, scenario, year);
  return geographies.flatMap(({ id, label, geographyType, geoId }) => {
    const value = values.get(id);
    if (geographyType !== 'admin0' || !geoId || !included.has(id) || value === undefined) return [];
    return [{ uid: geoId, label, value }];
  });
}

export function r9MapValues(rows: WideRow[], scenario: string, year: number, included: Set<string>): MapValue[] {
  const values = valuesByRegion(rows, scenario, year);
  return WORLD_R9.flatMap((uid) => {
    const value = values.get(uid);
    return included.has(uid) && value !== undefined ? [{ uid, label: uid, value }] : [];
  });
}
