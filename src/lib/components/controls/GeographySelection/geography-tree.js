// Pure helpers that turn the flat GEOGRAPHIES map (keyed by type, each
// geography carrying a `parents` array) into the lookups the selector needs.
// Kept framework-free so it is unit-testable under `bun test`.

const CHILD_TYPE_ORDER = ['cities', 'river_basins', 'eez'];

/**
 * @param {Record<string, Array<{uid:string,label:string,geographyType:string,parents:string[]}>>} [geographies]
 * @param {Set<string>|null} [allowedUids]
 * @returns {{ byId: Record<string, object>, childrenByParent: Record<string, Record<string, object[]>>, countriesByContinent: Record<string, object[]> }}
 */
export function buildIndex(geographies, allowedUids = null) {
  const all = Object.values(geographies ?? {}).flat();

  const allById = {};
  for (const geo of all) allById[geo.uid] = geo;

  let includedUids = null;
  if (allowedUids) {
    includedUids = new Set(allowedUids);
    const includeParents = (uid) => {
      for (const parentUid of allById[uid]?.parents ?? []) {
        if (includedUids.has(parentUid)) continue;
        includedUids.add(parentUid);
        includeParents(parentUid);
      }
    };
    for (const uid of allowedUids) includeParents(uid);
  }

  const included = includedUids ? all.filter((geo) => includedUids.has(geo.uid)) : all;

  const byId = {};
  for (const geo of included) {
    byId[geo.uid] = allowedUids ? { ...geo, isSelectable: allowedUids.has(geo.uid) } : geo;
  }

  const childrenByParent = {};
  for (const geo of Object.values(byId)) {
    for (const parent of geo.parents ?? []) {
      (childrenByParent[parent] ??= {});
      (childrenByParent[parent][geo.geographyType] ??= []).push(geo);
    }
  }

  const byLabel = (a, b) => (a.label ?? '').localeCompare(b.label ?? '');
  const countriesByContinent = {};
  for (const country of Object.values(byId).filter((geo) => geo.geographyType === 'admin0')) {
    for (const parent of country.parents ?? []) {
      (countriesByContinent[parent] ??= []).push(country);
    }
  }
  for (const continent of Object.keys(countriesByContinent)) {
    countriesByContinent[continent].sort(byLabel);
  }

  return { byId, childrenByParent, countriesByContinent };
}

/**
 * The external geo id (ISO3 for countries, slug otherwise) used to match a
 * selected/hovered geography to its map geo-shape feature. Returns null when the
 * geography is unknown or has no geo id (e.g. continents).
 * @param {{byId: Record<string, {geoId?: string}>}} index
 * @param {string|undefined|null} uid
 * @returns {string|null}
 */
export function geoIdOf(index, uid) {
  if (!uid) return null;
  return index.byId[uid]?.geoId ?? null;
}

/**
 * The country (admin0) geographies among a geography's parents. For a
 * transboundary child (e.g. a river basin spanning several countries) this
 * returns every parent country; for a city, the single parent country.
 * @returns {object[]}
 */
export function parentCountriesOf(index, uid) {
  const geo = index.byId[uid];
  if (!geo) return [];
  return (geo.parents ?? [])
    .map((p) => index.byId[p])
    .filter((p) => p && p.geographyType === 'admin0');
}

/**
 * The continent geography among a geography's parents, or null. Continents are a
 * grouping type that countries point at via their `parents` array.
 * @returns {object|null}
 */
export function continentOf(index, uid) {
  const geo = index.byId[uid];
  if (!geo) return null;
  for (const p of geo.parents ?? []) {
    const parent = index.byId[p];
    if (parent && parent.geographyType === 'continent') return parent;
  }
  return null;
}

/**
 * Child types present under a country, with counts, in a stable display order.
 * @returns {Array<{type:string,count:number}>}
 */
export function childSummary(index, countryUid) {
  const children = index.childrenByParent[countryUid] ?? {};
  const summary = [];
  for (const type of CHILD_TYPE_ORDER) {
    const list = children[type];
    if (list && list.length) summary.push({ type, count: list.length });
  }
  return summary;
}

/**
 * Children of a country grouped by type, in `CHILD_TYPE_ORDER`. Parallels
 * `childSummary` but returns the full child objects (for inline rendering).
 * @returns {Array<{type:string,items:object[]}>}
 */
export function childGroups(index, countryUid) {
  const children = index.childrenByParent[countryUid] ?? {};
  const groups = [];
  for (const type of CHILD_TYPE_ORDER) {
    const items = children[type];
    if (items && items.length) groups.push({ type, items });
  }
  return groups;
}
