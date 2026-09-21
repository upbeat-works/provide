import { NotFound } from '@iiasa/ixmp4-ts';
import { EMISSIONS_VARIABLE, GMT_REGION } from '../conventions';
import { dfToRows, yearColumns, type DataFrameLike, type WideRow } from '../tabulate';

export interface EmissionsCharacteristics {
  emissions2050?: number;
  emissions2100?: number;
}

export interface EmissionsSeries {
  data: Array<{ year: number; value: number | null }>;
  unit: 'GtCO2eq/yr';
  scenario: string;
  characteristics: EmissionsCharacteristics;
  model?: string;
}

export type EmissionsByScenario = Map<string, EmissionsSeries>;

const round = (value: number) => Number(value.toFixed(1));

function unitDivisor(unit: unknown): number {
  if (unit === 'Mt CO2-equiv/yr' || unit === 'Mt CO2eq/yr') return 1000;
  if (unit === 'Gt CO2-equiv/yr' || unit === 'Gt CO2eq/yr' || unit === 'GtCO2eq/yr') return 1;
  throw new Error(`Unsupported emissions unit: ${String(unit)}`);
}

export function assembleEmissions(rows: WideRow[]): EmissionsByScenario {
  const emissions: EmissionsByScenario = new Map();
  for (const row of rows) {
    const years = yearColumns(row);
    const hasValue = years.some((year) => typeof row[String(year)] === 'number' && Number.isFinite(row[String(year)]));
    if (!hasValue) continue;

    const divisor = unitDivisor(row.unit);
    const data = years.map((year) => {
      const sourceValue = row[String(year)];
      const value = typeof sourceValue === 'number' && Number.isFinite(sourceValue) ? sourceValue / divisor : null;
      return { year, value };
    });
    const first = data.findIndex(({ value }) => value !== null);
    const last = data.findLastIndex(({ value }) => value !== null);
    const points = data.slice(first, last + 1);
    const valueAt = (year: number) => points.find((point) => point.year === year)?.value;
    const characteristics: EmissionsCharacteristics = {};
    const emissions2050 = valueAt(2050);
    const emissions2100 = valueAt(2100);
    if (emissions2050 !== undefined && emissions2050 !== null) characteristics.emissions2050 = round(emissions2050);
    if (emissions2100 !== undefined && emissions2100 !== null) characteristics.emissions2100 = round(emissions2100);

    emissions.set(row.scenario.toLowerCase(), {
      scenario: row.scenario,
      unit: 'GtCO2eq/yr',
      data: points,
      characteristics,
      ...(typeof row.model === 'string' && row.model ? { model: row.model } : {}),
    });
  }
  return emissions;
}

type PlatformLike = { iamc: { tabulate: (query: unknown) => Promise<unknown> } };

export async function fetchEmissionsSeries(platform: PlatformLike): Promise<EmissionsByScenario> {
  let frame: unknown;
  try {
    frame = await platform.iamc.tabulate({
      region: { name: GMT_REGION },
      variable: { name: EMISSIONS_VARIABLE },
      wide: true,
    });
  } catch (reason) {
    if (reason instanceof NotFound) return new Map();
    throw reason;
  }
  if (!frame) return new Map();
  return assembleEmissions(dfToRows(frame as DataFrameLike));
}
