/**
 * Global mean temperature — the climate emulator's warming trajectory.
 *
 * GMT is not a catalog indicator: it has no parameter axes and only one region
 * (`World`). It is a property of a *scenario*, so it surfaces two ways:
 *   - on `/catalog` scenario entries (the methodology timeline chart + the
 *     scenario characteristics table), and
 *   - as `response.gmt` on impact-time, colouring the chart line.
 *
 * Two quirks of the published data drive the design here:
 *   - The percentile LABELS are not in value order — the "10th Percentile" series
 *     carries the highest values. Band edges are therefore taken numerically.
 *   - Base scenarios stop at 2100 while their long-term variants run to 2300, so
 *     a scenario's series is trimmed to the years it has rather than NaN-padded.
 *
 * Pure assembly here, I/O at the bottom edge — same split as views/impact-time.ts.
 */
import { createPlatform } from '../platform';
import { composeGmtVariable, GMT_PERCENTILES, GMT_REGION } from '../conventions';
import { caseInsensitiveLookup } from '../util';
import { dfToRows, type DataFrameLike, type WideRow } from '../tabulate';
import { alignBands, type PercentileSeries, type ScenarioBands } from './impact-time';
import type { Ixmp4Instance } from '../types';

/** The scenario characteristics the methodology table renders. All derived from the median. */
export interface GmtCharacteristics {
  /** [°C, year] — the highest median at or before 2100. */
  gmtPeak?: [number, number];
  gmt2100?: number;
  /** Absent when the scenario stops at 2100. */
  gmt2300?: number;
  /** °C per decade, peak → 2100. Absent when warming peaks at 2100. */
  coolingRateAfterPeak?: number;
  /** °C, peak → 2300; positive means it cooled. Absent without a 2300 value. */
  coolingAfterPeak?: number;
}

export interface GmtSeries {
  /** [min, median, max] per year, edges taken numerically. */
  data: [number, number, number][];
  yearStart: number;
  yearStep: number;
  yearEnd: number;
  characteristics: GmtCharacteristics;
  /** The raw ixmp4 scenario name (for display); the map key is its lowercase form. */
  scenario: string;
  model?: string;
  unit?: string;
}

/** Keyed by lowercased scenario name, matching how the rest of the adapter compares them. */
export type GmtByScenario = Map<string, GmtSeries>;

const MEDIAN = '50th Percentile';
// Both the 2100 and the 2300 table columns describe the peak as "before 2100",
// so the peak window is the same for either timeframe.
const PEAK_WINDOW_END = 2100;

const round = (n: number, dp: number) => Number(n.toFixed(dp));

/**
 * Peak / end-state warming and the post-peak cooling, from the MEDIAN trajectory
 * (the band is presentational). Keys are OMITTED rather than nulled when they
 * can't be derived — the table's `raw == null` branch already renders an em-dash
 * and drops the cell from its colour domain.
 */
export function gmtCharacteristics(points: Array<{ year: number; value: number }>): GmtCharacteristics {
  const finite = points.filter((p) => Number.isFinite(p.value));
  if (!finite.length) return {};

  const out: GmtCharacteristics = {};
  const at = (year: number) => finite.find((p) => p.year === year)?.value;

  // Ascending years so a tie reports the earliest peak.
  const window = [...finite].filter((p) => p.year <= PEAK_WINDOW_END).sort((a, b) => a.year - b.year);
  const peak = window.reduce<{ year: number; value: number } | undefined>(
    (best, p) => (best === undefined || p.value > best.value ? p : best),
    undefined,
  );
  if (peak) out.gmtPeak = [round(peak.value, 1), peak.year];

  const v2100 = at(2100);
  if (v2100 !== undefined) out.gmt2100 = round(v2100, 1);
  const v2300 = at(2300);
  if (v2300 !== undefined) out.gmt2300 = round(v2300, 1);

  if (peak && v2100 !== undefined && peak.year < PEAK_WINDOW_END) {
    const decades = (PEAK_WINDOW_END - peak.year) / 10;
    out.coolingRateAfterPeak = round((peak.value - v2100) / decades, 2);
  }
  if (peak && v2300 !== undefined) out.coolingAfterPeak = round(peak.value - v2300, 1);

  return out;
}

/**
 * Zip the three GMT percentile series into a per-year [min, median, max] band.
 * Edges are min/max over the finite values at that year — NEVER the label order
 * (see the module note). A scenario is trimmed to the contiguous span where its
 * median is finite, so a 2100-only scenario on a 2300 union axis yields 17
 * points rather than a NaN tail. Pure.
 */
export function assembleGmt(
  years: number[],
  byPct: Record<string, PercentileSeries>,
): GmtByScenario {
  const out: GmtByScenario = new Map();
  const medians = byPct[MEDIAN] ?? {};

  for (const [scenario, median] of Object.entries(medians)) {
    const finiteAt = (i: number) =>
      Object.values(byPct)
        .map((series) => series[scenario]?.[i])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

    const present = years.map((_, i) => Number.isFinite(median[i]));
    const first = present.indexOf(true);
    if (first === -1) continue;
    const last = present.lastIndexOf(true);

    const data: [number, number, number][] = [];
    for (let i = first; i <= last; i++) {
      const values = finiteAt(i);
      // An interior gap keeps its NaN — the chart draws a break rather than a
      // fabricated straight line through it.
      data.push(values.length ? [Math.min(...values), median[i], Math.max(...values)] : [NaN, NaN, NaN]);
    }

    out.set(scenario.toLowerCase(), {
      data,
      yearStart: years[first],
      yearEnd: years[last],
      yearStep: last > first ? years[first + 1] - years[first] : 0,
      characteristics: gmtCharacteristics(
        data.map((triple, i) => ({ year: years[first + i], value: triple[1] })),
      ),
      scenario,
    });
  }
  return out;
}

/**
 * Project GMT bands onto a foreign year axis — the indicator chart's own years,
 * which come from a different model and need not match GMT's grid. A year GMT
 * lacks becomes NaN at that index rather than shifting the series. Scenarios are
 * matched case-insensitively; output keys are the REQUESTED names. Pure.
 */
export function gmtBandsForYears(
  gmt: GmtByScenario,
  years: number[],
  scenarios: string[],
): ScenarioBands {
  const NO_DATA: [number, number, number] = [NaN, NaN, NaN];
  const bands: ScenarioBands = {};
  const find = caseInsensitiveLookup([...gmt.keys()]);

  for (const scenario of scenarios) {
    const key = find(scenario);
    const series = key ? gmt.get(key) : undefined;
    if (!series) continue;
    const byYear = new Map(series.data.map((triple, i) => [series.yearStart + series.yearStep * i, triple]));
    bands[scenario] = years.map((y) => byYear.get(y) ?? NO_DATA);
  }
  return bands;
}

// ---- I/O edge -------------------------------------------------------------

type PlatformLike = { iamc: { tabulate: (query: unknown) => Promise<unknown> } };

/**
 * The three World GMT percentile series from one platform — three tabulates, no
 * per-scenario calls. A missing variable yields an empty map rather than an
 * error, so an instance without the emulator runs degrades to "no GMT" instead
 * of sinking /catalog (the same defence fetchScenarioTimeframes uses).
 */
export async function fetchGmtSeries(platform: PlatformLike): Promise<GmtByScenario> {
  const rowsByPct: Record<string, WideRow[]> = {};
  let model: string | undefined;
  let unit: string | undefined;

  const dfs = await Promise.all(
    GMT_PERCENTILES.map(async (value) => {
      try {
        return await platform.iamc.tabulate({
          region: { name: GMT_REGION },
          variable: { name: composeGmtVariable(value) },
          wide: true,
        });
      } catch {
        return undefined;
      }
    }),
  );

  GMT_PERCENTILES.forEach((value, i) => {
    const df = dfs[i];
    const rows = df ? dfToRows(df as DataFrameLike) : [];
    rowsByPct[value] = rows;
    for (const row of rows) {
      model ??= row.model;
      if (!unit && typeof row.unit === 'string' && row.unit) unit = row.unit;
    }
  });

  const { years, byPct } = alignBands(rowsByPct);
  const series = assembleGmt(years, byPct);
  for (const entry of series.values()) {
    entry.model = model;
    entry.unit = unit;
  }
  return series;
}

/** Same, across every instance; the first instance carrying a scenario wins. */
export async function fetchGmtSeriesAcross(
  platforms: Array<{ platform: PlatformLike }>,
): Promise<GmtByScenario> {
  const merged: GmtByScenario = new Map();
  for (const { platform } of platforms) {
    for (const [key, series] of await fetchGmtSeries(platform)) {
      if (!merged.has(key)) merged.set(key, series);
    }
  }
  return merged;
}

/** Instance + creds entry point, mirroring fetchImpactTime's signature. */
export async function fetchGmt(
  instance: Ixmp4Instance,
  creds: { username: string; password: string },
): Promise<GmtByScenario> {
  return fetchGmtSeries(await createPlatform(instance, creds.username, creds.password));
}
