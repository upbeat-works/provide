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
