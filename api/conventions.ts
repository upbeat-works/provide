/**
 * The PROVIDE variable naming convention. ixmp4 exposes only the variable name,
 * so the pipe-delimited name IS the structured metadata. Parsing it lets the
 * ~2500 raw variable strings collapse into a handful of searchable indicators
 * with their available facet values — the basis for moving the catalog off the
 * hand-curated layer and onto conventions.
 *
 *   Indicator | Period | Temporal | Spatial | Value
 *
 * with one special case, the emissions trajectory: `Emissions|CO2`.
 *
 * The Value segment is one of two axes, distinguished by suffix:
 *   - warming level: "1.5 °C"        (unit is always % — exceedance probability)
 *   - percentile:    "50th Percentile" (the indicator's natural unit)
 */

export interface ParsedValue {
  kind: 'warmingLevel' | 'percentile';
  raw: string;
  number: number;
}

/**
 * Two variable shapes live in ixmp4:
 *  - `faceted` — the 5-segment grammar above; these are the searchable catalog
 *    indicators, the only ones with parameter axes.
 *  - `global` — a facet-free trajectory of the whole planet: the 2-segment
 *    `Indicator|Value` form (`Global Mean Temperature|50th Percentile`) and
 *    `Emissions|CO2`. These are properties of a scenario, not selectable
 *    indicators, so they never enter the catalog's indicator list.
 */
export type VariableKind = 'faceted' | 'global';

export interface ParsedVariable {
  raw: string;
  indicator: string;
  kind: VariableKind;
  period?: string;
  temporal?: string;
  spatial?: string;
  value?: ParsedValue;
}

function parseValue(segment: string): ParsedValue | undefined {
  const warming = segment.match(/^(-?\d+(?:\.\d+)?)\s*°C$/);
  if (warming) return { kind: 'warmingLevel', raw: segment, number: Number(warming[1]) };
  const percentile = segment.match(/^(\d+)(?:st|nd|rd|th)\s+Percentile$/i);
  if (percentile) return { kind: 'percentile', raw: segment, number: Number(percentile[1]) };
  return undefined;
}

export interface VariableParts {
  indicator: string;
  period: string;
  temporal: string;
  spatial: string;
  value: string;
}

/**
 * Build the exact ixmp4 variable name for a fully-specified parameter selection
 * — the inverse of parseVariable. Used at fetch time to resolve which series to
 * query (e.g. one per percentile to assemble a projection band).
 */
export function composeVariable(parts: VariableParts): string {
  return [parts.indicator, parts.period, parts.temporal, parts.spatial, parts.value].join('|');
}

// Default facets for the default chart view and for "does this indicator have
// data here" probes. Shared by /geographies, /scenarios and impact-time so the
// representative variable name stays consistent across endpoints.
export const FACET_DEFAULTS = { period: '2011-2020 (Present Day)', temporal: 'Annual', spatial: 'Area' };
export const REPRESENTATIVE_VALUE = '50th Percentile';

// The present-day baseline is carried as its own run named "Today" (its year-2000
// values become the unavoidable-risk `today` array). It is never a selectable
// projection scenario, so the avoid view's availability probe excludes it.
export const BASELINE_SCENARIO = 'Today';

// Global mean temperature: the climate emulator's warming trajectory, published
// as a 2-segment global variable at the `World` region (the only non-country
// region in the instance). It is a property of a scenario, not an indicator.
export const GMT_INDICATOR = 'Global Mean Temperature';
export const GMT_REGION = 'World';
// GMT publishes 10/50/90, not the 5/50/95 the indicator bands use — and in this
// data the label order is NOT the value order (the "10th" series carries the
// highest values), so callers must take band edges numerically. See views/gmt.ts.
export const GMT_PERCENTILES = ['10th Percentile', '50th Percentile', '90th Percentile'] as const;

/** The ixmp4 variable name for one GMT percentile — the 2-segment inverse of parseVariable. */
export function composeGmtVariable(value: string): string {
  return `${GMT_INDICATOR}|${value}`;
}

/**
 * A fully-faceted variable name for an indicator (representative value = the
 * median), used to probe which regions/scenarios have data for it. An indicator
 * is many variables; this picks one canonical series to test for existence.
 */
export function representativeVariable(
  indicator: string,
  facets: { period?: string; temporal?: string; spatial?: string } = {},
): string {
  return composeVariable({
    indicator,
    period: facets.period ?? FACET_DEFAULTS.period,
    temporal: facets.temporal ?? FACET_DEFAULTS.temporal,
    spatial: facets.spatial ?? FACET_DEFAULTS.spatial,
    value: REPRESENTATIVE_VALUE,
  });
}

export interface IndicatorFacets {
  uid: string;
  label: string;
  periods: string[];
  temporals: string[];
  spatials: string[];
  warmingLevels: string[];
  percentiles: string[];
}

/**
 * Collapse a flat list of ixmp4 variable names into one entry per indicator,
 * each carrying the distinct facet values present for it. Facet values keep
 * their raw convention strings; the two numeric value axes are sorted ascending.
 */
export function indicatorsFromVariables(names: string[]): IndicatorFacets[] {
  // Each indicator accumulates its facets here. The two numeric value axes are
  // kept as raw->number maps (alongside the entry, not in a side table) so they
  // can be sorted numerically at the end.
  interface Accumulator {
    entry: IndicatorFacets;
    warmingLevels: Map<string, number>;
    percentiles: Map<string, number>;
  }
  const byIndicator = new Map<string, Accumulator>();

  const add = (list: string[], v?: string) => {
    if (v && !list.includes(v)) list.push(v);
  };

  for (const name of names) {
    const p = parseVariable(name);
    // Global trajectories (GMT, Emissions) have no parameter axes, so they would
    // land here as a selectable indicator with empty dropdowns and no data behind
    // it. They surface per-scenario instead — see views/gmt.ts.
    if (p.kind !== 'faceted') continue;
    let acc = byIndicator.get(p.indicator);
    if (!acc) {
      acc = {
        entry: { uid: p.indicator, label: p.indicator, periods: [], temporals: [], spatials: [], warmingLevels: [], percentiles: [] },
        warmingLevels: new Map(),
        percentiles: new Map(),
      };
      byIndicator.set(p.indicator, acc);
    }
    add(acc.entry.periods, p.period);
    add(acc.entry.temporals, p.temporal);
    add(acc.entry.spatials, p.spatial);
    if (p.value?.kind === 'warmingLevel') acc.warmingLevels.set(p.value.raw, p.value.number);
    if (p.value?.kind === 'percentile') acc.percentiles.set(p.value.raw, p.value.number);
  }

  const sortedKeys = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => a[1] - b[1]).map(([raw]) => raw);

  return [...byIndicator.values()].map(({ entry, warmingLevels, percentiles }) => ({
    ...entry,
    warmingLevels: sortedKeys(warmingLevels),
    percentiles: sortedKeys(percentiles),
  }));
}

export function parseVariable(name: string): ParsedVariable {
  const segments = name.split('|');
  const parsed: ParsedVariable = { raw: name, indicator: segments[0], kind: 'global' };
  // Standard five-segment grammar: Indicator|Period|Temporal|Spatial|Value.
  if (segments.length === 5) {
    parsed.kind = 'faceted';
    parsed.period = segments[1];
    parsed.temporal = segments[2];
    parsed.spatial = segments[3];
    parsed.value = parseValue(segments[4]);
  } else if (segments.length === 2) {
    // `Indicator|Value` — a global trajectory. The value axis is the same one the
    // faceted grammar uses, so parseValue recovers the percentile here too;
    // `Emissions|CO2` simply has no parseable value.
    parsed.value = parseValue(segments[1]);
  }
  return parsed;
}
