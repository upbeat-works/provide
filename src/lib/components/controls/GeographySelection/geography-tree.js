// Pure helpers that turn the flat GEOGRAPHIES map (keyed by type, each
// geography carrying a `parents` array) into the lookups the selector needs.
// Kept framework-free so it is unit-testable under `bun test`.

// Display order for the types a country can be drilled into. Anything not
// listed still shows (appended alphabetically) — a new geography type must
// never silently disappear from the tree.
const CHILD_TYPE_ORDER = ['cities', 'macroeconomies', 'river_basins', 'glacier_regions', 'eez', 'northern_latitudes'];

// Countries and continents are the tree's roots, never a country's children.
const ROOT_TYPES = new Set(['continent', 'admin0']);

/**
 * @param {Record<string, Array<{uid:string,label:string,geographyType:string,parents:string[]}>>} [geographies]
 * @returns {{ byId: Record<string, object>, childrenByParent: Record<string, Record<string, object[]>>, countriesByContinent: Record<string, object[]> }}
 */
export function buildIndex(geographies) {
  const all = Object.values(geographies ?? {}).flat();

  const byId = {};
  for (const geo of all) byId[geo.uid] = geo;

  const childrenByParent = {};
  for (const geo of all) {
    for (const parent of geo.parents ?? []) {
      (childrenByParent[parent] ??= {});
      (childrenByParent[parent][geo.geographyType] ??= []).push(geo);
    }
  }

  const byLabel = (a, b) => (a.label ?? '').localeCompare(b.label ?? '');
  const countriesByContinent = {};
  for (const country of geographies?.admin0 ?? []) {
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
  return childGroups(index, countryUid).map(({ type, items }) => ({ type, count: items.length }));
}

/**
 * Children of a country grouped by type, in `CHILD_TYPE_ORDER`. Parallels
 * `childSummary` but returns the full child objects (for inline rendering).
 * @returns {Array<{type:string,items:object[]}>}
 */
export function childGroups(index, countryUid) {
  const children = index.childrenByParent[countryUid] ?? {};
  const types = Object.keys(children).filter((type) => !ROOT_TYPES.has(type) && children[type]?.length);
  types.sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b));
  return types.map((type) => ({ type, items: children[type] }));
}

function rankOf(type) {
  const rank = CHILD_TYPE_ORDER.indexOf(type);
  return rank === -1 ? CHILD_TYPE_ORDER.length : rank;
}

/**
 * A geography type's label without its parenthetical abbreviation
 * ("River Basins (RB)" → "River Basins"). The abbreviation earns its space in
 * the compact selection button, not in the tree or the map's summary tags.
 * @param {string|undefined|null} label
 * @returns {string}
 */
export function plainLabel(label) {
  return String(label ?? '')
    .replace(/\s*\([^()]*\)\s*$/, '')
    .trim();
}
