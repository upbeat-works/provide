import { MAX_NUMBER_SELECTABLE_SCENARIOS } from '$config';
import MAP_INDICATOR_IDS from './legacy-map-indicators.json';

// The explore-to-avoid boundary sends old API IDs. Incoming choices use exact
// canonical IDs.

export function toLegacyGeoId(geo) {
  return geo?.geoId ?? undefined;
}

export function resolveGeo(value, geographies = []) {
  if (!value) return undefined;
  return geographies.find((geography) => (geography.id ?? geography.uid) === value);
}

const AVOID_INDICATOR_IDS = {
  'Days a Year with Maximum Temperatures Above X°C': 'urbclim-T2M-dayoverX',
  'Nights a Year with Minimum Temperatures Above X°C': 'urbclim-T2M-nightoverX',
  'Days a Year with Extreme Heat Stress': 'urbclim-WBGT-dayover31',
  'Days a Year with Very High Heat Stress': 'urbclim-WBGT-dayover295',
  'Cooling Degree Hours': 'urbclim-cooling-degree-hours',
  'Lost Working Hours per Year for Intense Activities': 'urbclim-LWH-int',
  'Heatwave Days per Year': 'urbclim-heatwave-days',
  'Population Exposed to Heatwaves': 'urbclim-heatwaves-population-exposed',
};
const CANONICAL_AVOID_INDICATOR_IDS = new Map(Object.entries(AVOID_INDICATOR_IDS).map(([id, legacyId]) => [legacyId, id]));
const LEGACY_DATA_INSTANCE = 'provide-internal';

export function toLegacyAvoidIndicatorUid(id) {
  return AVOID_INDICATOR_IDS[id];
}

export function toLegacyMapIndicatorUid(indicator) {
  if (indicator?.instance !== LEGACY_DATA_INSTANCE) return undefined;
  return MAP_INDICATOR_IDS[indicator?.id ?? indicator?.uid];
}

export function canonicalAvoidIndicatorUid(legacyId) {
  return CANONICAL_AVOID_INDICATOR_IDS.get(legacyId);
}

export function resolveCanonicalAvoidUrlSelection(selection, cities = []) {
  if (selection?.instance !== LEGACY_DATA_INSTANCE || !toLegacyAvoidIndicatorUid(selection.indicator)) return undefined;
  const city = cities.find((candidate) => [candidate.id, candidate.label, candidate.uid].includes(selection.geography));
  if (!city) return undefined;
  return { geography: selection.geography, indicator: selection.indicator, instance: selection.instance };
}

export function resolveIndicator(value, indicators = []) {
  if (!value) return undefined;
  return indicators.find((indicator) => (indicator.id ?? indicator.uid) === value);
}

const LEGACY_SCENARIO_UIDS = new Map(Object.entries({
  '2020 Climate Policies': 'curpol',
  '2020 Climate Policies then back to 1.5 °C': 'curpol-os',
  '2020 Climate Policies then Stabilisation': 'curpol-sap',
  'Delayed Climate Action': 'gs',
  'Delayed Climate Action then Net Zero': 'gs-nzghg',
  'Shifting Pathway': 'sp',
  'Shifting Pathway then Net Zero': 'sp-nzghg',
  '2020 Climate Targets': 'modact',
  '2020 Climate Targets then back to 1.5 °C': 'modact-os-1.5c',
  '2020 Climate Targets then back to 1 °C': 'modact-os-1c',
  '2020 Climate Targets then Stabilisation': 'modact-sap',
  'High Negative Emissions': 'neg',
  'High Negative Emissions then Net Zero': 'neg-nzghg',
  'High Negative Emissions then back to 0 °C': 'neg-os-0',
  'High Negative Emissions then Stabilisation': 'neg-sap',
  'High Renewables': 'ren',
  'High Renewables then Net Zero CO2': 'ren-nzco2',
  'Low Demand': 'ld',
  'Low Demand then Net Zero': 'ld-nzghg',
  'SSP1-1.9': 'ssp119',
  'SSP1-1.9 (Extended)': 'ssp119-extended',
  'SSP5-3.4-Overshoot': 'ssp534-over',
  'SSP5-3.4-Overshoot (Extended)': 'ssp534-over-extended',
  'Stabilisation at 1.5 °C': 'ref-1p5',
  'Stabilisation at 1.5 °C (Extended)': 'ref-1p5-extended',
}));

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

export function toLegacyScenarioUid(uid) {
  if (!uid) return undefined;
  return LEGACY_SCENARIO_UIDS.get(uid);
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

const CANONICAL_AVOID_PARAMETER_VALUES = {
  time: new Map(Object.entries(LEGACY_PARAMETER_VALUES.time).map(([value, legacy]) => [legacy, value])),
  reference: new Map(Object.entries(LEGACY_PARAMETER_VALUES.reference).map(([value, legacy]) => [legacy, value])),
  spatial: new Map(Object.entries(LEGACY_PARAMETER_VALUES.spatial).map(([value, legacy]) => [legacy, value])),
};
CANONICAL_AVOID_PARAMETER_VALUES.reference.set('absolute', '2011-2020 (Present Day)');

export function canonicalAvoidParameterValues(values = {}) {
  const result = {};
  for (const [key, value] of Object.entries(values ?? {})) {
    result[key] = CANONICAL_AVOID_PARAMETER_VALUES[key]?.get(value) ?? value;
  }
  return result;
}

export function toLegacyAvoidRequest({ geography, indicator, scenarios, parameters = {} }) {
  if (indicator?.instance !== LEGACY_DATA_INSTANCE) return undefined;
  const result = {
    geography: toLegacyGeoId(geography),
    indicator: toLegacyAvoidIndicatorUid(indicator?.id ?? indicator?.uid),
    ...toLegacyParameterValues(parameters),
  };
  if (scenarios) result.scenarios = toLegacyScenarioUids(scenarios);
  return result;
}

export function canonicalAvoidShareSelection({ geography, indicator, parameters = {} }) {
  return {
    geography: geography?.id ?? geography?.uid,
    indicator: indicator?.id ?? indicator?.uid,
    instance: indicator?.instance,
    ...parameters,
  };
}

// Scenario IDs arriving from a URL are checked against the canonical index.
export function resolveScenarioUids(values, scenarios = []) {
  let list = [];
  if (Array.isArray(values)) {
    list = values;
  } else if (values) {
    list = [values];
  }
  const known = new Set(scenarios.map((scenario) => scenario.id ?? scenario.uid));
  const out = [];
  for (const value of list) {
    if (known.has(value) && !out.includes(value)) out.push(value);
  }
  return out.slice(0, MAX_NUMBER_SELECTABLE_SCENARIOS);
}
