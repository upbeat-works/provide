import { MAX_NUMBER_SELECTABLE_SCENARIOS } from '$config';

// The single explore<->avoid translation boundary. Geographies bridge on geoId
// (== legacy uid, verified in the D1 seed); indicators bridge on the curated
// legacyUid carried on catalog indicators from the enrichment join. Resolvers
// accept EITHER id space (new uid or legacy) and normalise to the new object —
// legacy ids (ISO3/slug, sector-prefixed) never collide with convention names.

export function toLegacyGeoId(geo) {
  return geo?.geoId ?? undefined;
}

export function resolveGeo(value, geographies = []) {
  if (!value) return undefined;
  return geographies.find((g) => g.uid === value) ?? geographies.find((g) => g.geoId === value);
}

export function toLegacyIndicatorUid(newUid, indicators = []) {
  return indicators.find((i) => i.uid === newUid)?.legacyUid ?? undefined;
}

export function resolveIndicator(value, indicators = []) {
  if (!value) return undefined;
  return indicators.find((i) => i.uid === value) ?? indicators.find((i) => i.legacyUid === value);
}

// Scenario names are the ixmp4 run names in the new id space and opaque slugs in
// the legacy one, so the bridge is a table. It is derived from the frozen legacy
// `/meta` scenario LABELS (e.g. legacy `curpol` is labelled "2020 climate
// policies", which is the convention name verbatim); the mapping is written out
// rather than resolved at runtime so the explore page doesn't have to load the
// legacy meta payload just to render a map. Every legacy scenario here is the
// 2100 variant — the convention scenarios all end in 2100, never the `-extended`
// 2300 twins. `Today` is the present-day baseline and has no legacy projection.
const LEGACY_SCENARIO_UIDS = {
  '2020 Climate Policies': 'curpol',
  '2020 Climate Targets': 'modact',
  'Delayed Climate Action': 'gs',
  'High Negative Emissions': 'neg',
  'High Renewables': 'ren',
  'Low Demand': 'ld',
  'Shifting Pathway': 'sp',
  'SSP1-1.9': 'ssp119',
  'SSP5-3.4-OS': 'ssp534-over',
  'Stabilisation At 1.5°C': 'ref-1p5',
};

// Convention parameter values → the legacy API's slugs, per dimension. Closed
// sets (the whole selectable universe of each), so an unmapped value means the
// selection has no legacy equivalent rather than a gap in this table.
const LEGACY_PARAMETER_VALUES = {
  time: {
    Annual: 'annual',
    'December - February': 'djf',
    'March - May': 'mam',
    'June - August': 'jja',
    'September - November': 'son',
  },
  reference: {
    '2011-2020 (Present Day)': 'present-day',
    '1850-1900 (Pre-industrial)': 'pre-industrial',
  },
  spatial: { Area: 'area' },
};

const lowerKeys = (table) =>
  new Map(Object.entries(table).map(([name, uid]) => [name.toLowerCase(), uid]));

// ixmp4 carries case-only duplicate run names, so match scenarios case-insensitively.
const LEGACY_SCENARIOS_BY_LOWER = lowerKeys(LEGACY_SCENARIO_UIDS);

export function toLegacyScenarioUid(uid) {
  if (!uid) return undefined;
  return LEGACY_SCENARIOS_BY_LOWER.get(String(uid).toLowerCase());
}

/** The mappable subset, in the order given — scenarios with no legacy twin drop out. */
export function toLegacyScenarioUids(uids = []) {
  return (Array.isArray(uids) ? uids : [uids]).map(toLegacyScenarioUid).filter(Boolean);
}

/**
 * Translate a `{ time, reference, spatial }` selection into the legacy slugs.
 * A dimension this table doesn't know passes through untouched (it is already a
 * legacy-shaped value, e.g. `frequency: '0.05'`); a known dimension holding an
 * unmappable value is omitted, so the legacy API falls back to its own default
 * rather than receiving a convention string it can't parse.
 */
export function toLegacyParameterValues(values = {}) {
  const out = {};
  for (const [key, value] of Object.entries(values ?? {})) {
    const table = LEGACY_PARAMETER_VALUES[key];
    if (!table) {
      out[key] = value;
      continue;
    }
    const legacy = table[value];
    if (legacy) out[key] = legacy;
  }
  return out;
}

// Scenario uids arriving from a URL (`?scenarios[0]=…`), normalised against the
// catalog: unknown ones dropped, casing canonicalised, capped at the selectable
// maximum. Case-insensitive because ixmp4 carries case-only duplicate runs.
export function resolveScenarioUids(values, scenarios = []) {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  const byLower = new Map(scenarios.map((s) => [String(s.uid).toLowerCase(), s.uid]));
  const out = [];
  for (const value of list) {
    const uid = byLower.get(String(value).toLowerCase());
    if (uid && !out.includes(uid)) out.push(uid);
  }
  return out.slice(0, MAX_NUMBER_SELECTABLE_SCENARIOS);
}
