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
