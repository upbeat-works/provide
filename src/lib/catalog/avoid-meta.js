// Pure shaping of the avoid page's catalog from the frozen legacy /meta. Kept
// alias-free so it is unit-testable under `bun test`; the fetch that feeds it
// lives in `loadAvoidMeta` (src/lib/utils/apis.js). Everything stays in the
// LEGACY id space (city uids, sector-prefixed indicator uids). The avoid page is
// cities-only, so only the city-available legacy indicators matter.
export function buildAvoidMeta(legacyMeta = {}, descriptions = {}) {
  const cityType = (legacyMeta.geographyTypes ?? []).find((t) => t.uid === 'cities');
  const cityIndicatorUids = new Set(cityType?.availableIndicators ?? []);
  const byUid = new Map((legacyMeta.indicators ?? []).map((i) => [i.uid, i]));
  const descByUid = new Map(
    (descriptions.indicators ?? []).map((d) => [d.attributes?.UID, d.attributes?.Description]),
  );
  // In legacy /meta, geography availability is defined at the SECTOR level (the
  // indicator's own `availableGeographies` is empty). Merge the two so each
  // indicator carries the city uids it actually has data for.
  const sectorGeos = new Map((legacyMeta.sectors ?? []).map((s) => [s.uid, s.availableGeographies ?? []]));
  // `indicator.unit` is a unit uid (string); resolve it to the full unit object
  // ({ uid, label, labelLong }) the UI + formatting expect, as the old meta did.
  const unitByUid = new Map((legacyMeta.units ?? []).map((u) => [u.uid, u]));

  const indicators = [...cityIndicatorUids]
    .map((uid) => byUid.get(uid)) // drops inert uids with no indicator metadata
    .filter(Boolean)
    .map((ind) => ({
      ...ind,
      description: descByUid.get(ind.uid),
      unit: unitByUid.get(ind.unit) ?? { uid: ind.unit, label: ind.unit, labelLong: ind.unit },
      availableGeographies: [...new Set([...(sectorGeos.get(ind.sector) ?? []), ...(ind.availableGeographies ?? [])])],
    }));

  return {
    // Legacy cities already carry `group` (parent country) and
    // `adaptationCaseStudy` — everything the grouped list + case-study cross-link
    // need, so no new-geo tree is required.
    cities: legacyMeta.cities ?? [],
    indicators,
    indicatorParameters: legacyMeta.indicatorParameters ?? [],
    sectors: legacyMeta.sectors ?? [],
    likelihoods: legacyMeta.likelihoods ?? [],
    studyLocations: legacyMeta.studyLocations ?? [],
    scenarios: legacyMeta.scenarios ?? [],
  };
}
