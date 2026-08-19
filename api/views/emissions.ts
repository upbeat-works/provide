/**
 * Global GHG emissions (Kyoto-basket CO2-equivalent) — the climate emulator's
 * other global-trajectory output, published at the same `World` region as GMT
 * (see conventions.ts) but as a single unbanded `Emissions|Kyoto Gases` series
 * per scenario, no percentile siblings.
 *
 * Surfaces the same way GMT does: on `/catalog` scenario entries, feeding the
 * methodology timeline chart (`scenario.emissions`) and merging into the same
 * `characteristics` object GMT populates (`emissions2050`, `emissions2100`).
 *
 * Pure assembly here, I/O at the bottom edge — same split as views/gmt.ts.
 */
import { createPlatform } from '../platform';
import { EMISSIONS_VARIABLE, GMT_REGION } from '../conventions';
import { dfToRows, yearColumns, type DataFrameLike, type WideRow } from '../tabulate';
import type { Ixmp4Instance } from '../types';

/** The scenario characteristics the methodology table renders. */
export interface EmissionsCharacteristics {
  emissions2050?: number;
  emissions2100?: number;
}

export interface EmissionsSeries {
  /** One value per year, GtCO2eq/yr. */
  data: number[];
  yearStart: number;
  yearStep: number;
  yearEnd: number;
  characteristics: EmissionsCharacteristics;
  /** The raw ixmp4 scenario name (for display); the map key is its lowercase form. */
  scenario: string;
  model?: string;
  unit?: string;
}

/** Keyed by lowercased scenario name, matching how the rest of the adapter compares them. */
export type EmissionsByScenario = Map<string, EmissionsSeries>;

const round = (n: number, dp: number) => Number(n.toFixed(dp));

/** Read off the 2050 / 2100 emissions values, omitted (not nulled) when absent. */
export function emissionsCharacteristics(points: Array<{ year: number; value: number }>): EmissionsCharacteristics {
  const at = (year: number) => points.find((p) => p.year === year)?.value;
  const out: EmissionsCharacteristics = {};

  const v2050 = at(2050);
  if (v2050 !== undefined && Number.isFinite(v2050)) out.emissions2050 = round(v2050, 1);
  const v2100 = at(2100);
  if (v2100 !== undefined && Number.isFinite(v2100)) out.emissions2100 = round(v2100, 1);

  return out;
}

// ixmp4 publishes Kyoto-basket emissions in Mt CO2-equiv/yr; the methodology
// chart and table labels (hardcoded in the Scenarios/Table components) read
// "GtCO₂eq/yr" — the unit the rest of the app's GHG formatting uses (see
// `gigaton-co2eq-year` in src/lib/utils/formatting.js). Convert once here so
// callers never see the raw Mt scale.
const MT_PER_GT = 1000;
const EMISSIONS_UNIT = 'GtCO2eq/yr';

/**
 * Zip the raw wide rows into a per-scenario value series (converted Mt → Gt),
 * trimmed to the contiguous span where the scenario has real (non-NaN) data —
 * the same rule gmt.ts's assembleGmt applies, so a 2100-only scenario doesn't
 * drag in a NaN tail from a 2300 union axis. Pure.
 */
export function assembleEmissions(years: number[], rows: WideRow[]): EmissionsByScenario {
  const out: EmissionsByScenario = new Map();

  for (const row of rows) {
    const series = years.map((y) => {
      const v = row[String(y)];
      return typeof v === 'number' ? v / MT_PER_GT : NaN;
    });
    const present = series.map((v) => Number.isFinite(v));
    const first = present.indexOf(true);
    if (first === -1) continue;
    const last = present.lastIndexOf(true);
    const data = series.slice(first, last + 1);

    out.set(row.scenario.toLowerCase(), {
      data,
      yearStart: years[first],
      yearEnd: years[last],
      yearStep: last > first ? years[first + 1] - years[first] : 0,
      characteristics: emissionsCharacteristics(data.map((value, i) => ({ year: years[first + i], value }))),
      scenario: row.scenario,
      model: typeof row.model === 'string' ? row.model : undefined,
      unit: EMISSIONS_UNIT,
    });
  }

  return out;
}

// ---- I/O edge -------------------------------------------------------------

type PlatformLike = { iamc: { tabulate: (query: unknown) => Promise<unknown> } };

/**
 * The World Emissions|Kyoto Gases series from one platform — one tabulate, no
 * per-scenario calls. A missing variable yields an empty map rather than an
 * error, so an instance without the emulator runs degrades to "no emissions"
 * instead of sinking /catalog (the same defence fetchGmtSeries uses).
 */
export async function fetchEmissionsSeries(platform: PlatformLike): Promise<EmissionsByScenario> {
  let df: unknown;
  try {
    df = await platform.iamc.tabulate({
      region: { name: GMT_REGION },
      variable: { name: EMISSIONS_VARIABLE },
      wide: true,
    });
  } catch {
    return new Map();
  }

  const rows = df ? dfToRows(df as DataFrameLike) : [];
  const yearSet = new Set<number>();
  for (const row of rows) for (const y of yearColumns(row)) yearSet.add(y);
  const years = [...yearSet].sort((a, b) => a - b);

  return assembleEmissions(years, rows);
}

/** Same, across every instance; the first instance carrying a scenario wins. */
export async function fetchEmissionsSeriesAcross(
  platforms: Array<{ platform: PlatformLike }>,
): Promise<EmissionsByScenario> {
  const merged: EmissionsByScenario = new Map();
  for (const { platform } of platforms) {
    for (const [key, series] of await fetchEmissionsSeries(platform)) {
      if (!merged.has(key)) merged.set(key, series);
    }
  }
  return merged;
}

/** Instance + creds entry point, mirroring fetchGmt's signature. */
export async function fetchEmissions(
  instance: Ixmp4Instance,
  creds: { username: string; password: string },
): Promise<EmissionsByScenario> {
  return fetchEmissionsSeries(await createPlatform(instance, creds.username, creds.password));
}
