import { createPlatform } from '../platform';
import { composeVariable, FACET_DEFAULTS } from '../conventions';
import { caseInsensitiveLookup } from '../util';
import { dfToRows, yearColumns, type DataFrameLike, type WideRow } from '../tabulate';
import type { Ixmp4Instance } from '../types';

export interface ImpactTimeParams {
  indicator: string;
  geography: string;
  scenarios: string[];
}

export interface ImpactTimeResponse {
  yearStart: number;
  yearStep: number;
  title: string;
  description: string;
  model: string;
  source: string;
  parameters: Record<string, unknown>;
  formats: string[];
  // Natural-language unit straight from the ixmp4 data's unit column (e.g. "°C").
  unit?: string;
  data: Record<string, [number, number, number][]>;
  // Per-scenario global-warming band ([min, mid, max] per year) used to colour
  // the chart line. Interim: sourced from Mean Temperature (pre-industrial) at
  // the chart's own region — regional, not global — until a World region exists.
  gmt?: Record<string, [number, number, number][]>;
}

// The default projection view fetches the 5th/50th/95th percentile series and
// zips them into a [min, value, max] band.
const PERCENTILES = ['5th Percentile', '50th Percentile', '95th Percentile'] as const;
const DEFAULTS = FACET_DEFAULTS;

// Per-scenario value series (one number per year, year-aligned) for a single
// percentile. Keyed by the ixmp4 scenario name, which is now the scenario id.
export type PercentileSeries = Record<string, number[]>;

export interface AssembleInput {
  indicator: string;
  years: number[];
  p5: PercentileSeries;
  p50: PercentileSeries;
  p95: PercentileSeries;
  scenarios: string[];
  model?: string;
  source?: string;
}

export type ScenarioBands = Record<string, [number, number, number][]>;

/**
 * Zip three per-scenario percentile series into `[min, mid, max]` triples per
 * year. Scenarios missing any of the three bands are dropped. Pure.
 */
export function zipBands(
  years: number[],
  lo: PercentileSeries,
  mid: PercentileSeries,
  hi: PercentileSeries,
  scenarios: string[],
): ScenarioBands {
  const bands: ScenarioBands = {};
  // The data is keyed by the raw ixmp4 scenario name, which may differ in case
  // from the requested (canonical) name — a source-duplicate like
  // `SSP5-3.4-Os` vs `SSP5-3.4-OS`. Match case-insensitively, key by requested.
  const findLo = caseInsensitiveLookup(Object.keys(lo));
  const findMid = caseInsensitiveLookup(Object.keys(mid));
  const findHi = caseInsensitiveLookup(Object.keys(hi));
  for (const scenario of scenarios) {
    const l = findLo(scenario);
    const m = findMid(scenario);
    const h = findHi(scenario);
    if (!l || !m || !h) continue;
    bands[scenario] = years.map((_, i) => [lo[l][i], mid[m][i], hi[h][i]]);
  }
  return bands;
}

/**
 * Zip the three percentile series into the legacy impact-time shape: for each
 * requested scenario, a per-year `[min, value, max]` triple (5th/50th/95th).
 * Pure so the assembly is unit-tested without touching ixmp4.
 */
export function assembleImpactTime(input: AssembleInput): ImpactTimeResponse {
  const { indicator, years, p5, p50, p95, scenarios } = input;
  const data = zipBands(years, p5, p50, p95, scenarios);
  return {
    yearStart: years[0] ?? 0,
    yearStep: years.length > 1 ? years[1] - years[0] : 0,
    title: indicator,
    description: '',
    model: input.model ?? '',
    source: input.source ?? '',
    parameters: {},
    formats: [],
    data,
  };
}


interface VariableBase {
  indicator: string;
  period: string;
  temporal: string;
  spatial: string;
}

// GMT is the global-warming trajectory. Interim: reuse the chart's own region
// (regional warming) since no World region exists yet; only the region changes
// when one does.
const GMT_BASE: VariableBase = {
  indicator: 'Mean Temperature',
  period: '1850-1900 (Pre-industrial)',
  temporal: 'Annual',
  spatial: 'Area',
};

interface FetchedBands {
  years: number[];
  p5: PercentileSeries;
  p50: PercentileSeries;
  p95: PercentileSeries;
  model?: string;
  unit?: string;
}

/**
 * Align the wide rows of each percentile onto a single union year axis, so the
 * three series for a scenario index by the SAME years in zipBands. A year a
 * scenario lacks (missing column or null cell) becomes NaN rather than shifting
 * later years left. Pure.
 */
export function alignBands(rowsByPct: Record<string, WideRow[]>): {
  years: number[];
  byPct: Record<string, PercentileSeries>;
} {
  const yearSet = new Set<number>();
  for (const rows of Object.values(rowsByPct)) {
    for (const row of rows) for (const y of yearColumns(row)) yearSet.add(y);
  }
  const years = [...yearSet].sort((a, b) => a - b);
  const byPct: Record<string, PercentileSeries> = {};
  for (const [value, rows] of Object.entries(rowsByPct)) {
    const perScenario: PercentileSeries = {};
    for (const row of rows) {
      perScenario[row.scenario] = years.map((y) => {
        const v = row[String(y)];
        return v == null ? NaN : Number(v);
      });
    }
    byPct[value] = perScenario;
  }
  return { years, byPct };
}

// Tabulate the three percentile variables of a base at one region (in parallel)
// and return per-scenario year series aligned to a common axis, ready for zipBands.
async function fetchBands(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  platform: any,
  region: string,
  base: VariableBase,
): Promise<FetchedBands> {
  const dfs = await Promise.all(
    PERCENTILES.map((value) =>
      platform.iamc.tabulate({
        region: { name: region },
        variable: { name: composeVariable({ ...base, value }) },
        wide: true,
      }),
    ),
  );
  const rowsByPct: Record<string, WideRow[]> = {};
  let model: string | undefined;
  let unit: string | undefined;
  PERCENTILES.forEach((value, i) => {
    const rows = dfToRows(dfs[i] as DataFrameLike);
    rowsByPct[value] = rows;
    for (const row of rows) {
      model ??= row.model;
      if (!unit && typeof row.unit === 'string' && row.unit) unit = row.unit;
    }
  });
  const { years, byPct } = alignBands(rowsByPct);
  return { years, p5: byPct['5th Percentile'], p50: byPct['50th Percentile'], p95: byPct['95th Percentile'], model, unit };
}

/**
 * Default impact-time view for a selected indicator + geography: resolves the
 * three percentile variables via the naming convention, tabulates each from
 * ixmp4, and assembles the legacy band shape. Also bundles a per-scenario GMT
 * band (see GMT_BASE) so the chart can colour its line in the same response.
 * Period/temporal/spatial default to Present Day · Annual · Area.
 */
export async function fetchImpactTime(
  instance: Ixmp4Instance,
  creds: { username: string; password: string },
  params: ImpactTimeParams & { period?: string; temporal?: string; spatial?: string },
): Promise<ImpactTimeResponse> {
  const platform = await createPlatform(instance, creds.username, creds.password);
  const base: VariableBase = {
    indicator: params.indicator,
    period: params.period ?? DEFAULTS.period,
    temporal: params.temporal ?? DEFAULTS.temporal,
    spatial: params.spatial ?? DEFAULTS.spatial,
  };

  const [indicatorBands, gmtBands] = await Promise.all([
    fetchBands(platform, params.geography, base),
    fetchBands(platform, params.geography, GMT_BASE),
  ]);

  const response = assembleImpactTime({
    indicator: params.indicator,
    years: indicatorBands.years,
    p5: indicatorBands.p5,
    p50: indicatorBands.p50,
    p95: indicatorBands.p95,
    scenarios: params.scenarios,
    model: indicatorBands.model,
    source: instance.slug,
  });
  response.gmt = zipBands(gmtBands.years, gmtBands.p5, gmtBands.p50, gmtBands.p95, params.scenarios);
  // Natural-language unit straight from the ixmp4 data (e.g. "°C", "%").
  response.unit = indicatorBands.unit;
  return response;
}
