/**
 * Imports the PROVIDE geographies YAML + hand-authored hierarchy into a SQLite
 * seed file. Pure builders are exported for testing; the CLI tail writes the file.
 *
 * Usage: bun run api/db/import/import-geographies.ts [yamlPath] [outPath]
 *
 * Convention: human-readable names act as both id and label for every
 * geography. Geography types are short stable slugs (cities, eez, admin0, …).
 */
import { readFileSync } from 'node:fs';
import * as hierarchyData from './geography-hierarchy';
import { countryIso3 } from './country-iso3';

export interface GType {
  id: string;
  items: string[];
}

export interface Hierarchy {
  continents: string[];
  countryContinent: Record<string, string>;
  cityCountry: Record<string, string>;
  eezCountry: Record<string, string[]>;
  riverBasinCountries: Record<string, string[]>;
}

// Type metadata, keyed by the YAML's top-level heading. Short stable slugs are
// the geography_type id so the frontend keeps using `meta.cities`, `meta.eez`.
const typeConfig: Record<string, { id: string; labelSingular: string }> = {
  Countries: { id: 'admin0', labelSingular: 'Country' },
  Cities: { id: 'cities', labelSingular: 'City' },
  'Exclusive Economic Zones (EEZ)': { id: 'eez', labelSingular: 'Exclusive Economic Zone (EEZ)' },
  'River Basins (RB)': { id: 'river_basins', labelSingular: 'River Basin (RB)' },
  'Glacier Regions (GR)': { id: 'glacier_regions', labelSingular: 'Glacier Region (GR)' },
  'Macroeconomies (ME)': { id: 'macroeconomies', labelSingular: 'Macroeconomy (ME)' },
  'Northern Latitudes': { id: 'northern_latitudes', labelSingular: 'Northern Latitude' },
};

const CONTINENT_TYPE = { id: 'continent', label: 'Continents', labelSingular: 'Continent' };

// Continent geography ids are namespaced so they never collide with a country
// of the same name (e.g. "Antarctica" is both a country and a continent). The
// label stays the plain name.
const continentId = (name: string): string => `continent:${name}`;

function esc(value: string | null | undefined): string {
  if (value == null || value === '') return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

// Geo ids the live geo-shapes key on differently from what the derived rule (or
// the standard ISO3 table) would produce — an alternate transliteration, or a
// non-standard country code the map uses for a disputed territory. Keyed by the
// catalog label; takes precedence over both the slug rule and the ISO3 lookup so
// the selection always matches the actual map feature uid.
const GEO_ID_OVERRIDES: Record<string, string> = {
  Belgrade: 'belgrado',
  'Ysyk Kol (RB)': 'ysyk-kol',
  // Disputed territories whose map shape uses a non-ISO3166 code.
  'Western Sahara': 'SAH', // ISO3 ESH
  Palestine: 'PSX', // ISO3 PSE
  'South Sudan': 'SDS', // ISO3 SSD
};

/**
 * The external id that links a catalog geography to its map geo-shape (and flag
 * asset). Countries (admin0) use ISO 3166-1 alpha-3 from `iso3ByCountry`; every
 * other type derives a slug matching the geo-shape `uid`: strip the trailing
 * type suffix (" (RB)", " (GR)", …), fold accents, lowercase, spaces → "_",
 * keeping other punctuation (commas, hyphens) as the source does. Returns null
 * when no id can be resolved (e.g. a country absent from the ISO3 table).
 */
export function deriveGeoId(
  typeSlug: string,
  label: string,
  iso3ByCountry: Record<string, string>,
): string | null {
  if (GEO_ID_OVERRIDES[label]) return GEO_ID_OVERRIDES[label];
  if (typeSlug === 'admin0') return iso3ByCountry[label] ?? null;
  return label
    .replace(/ø/gi, 'o')
    .replace(/å/gi, 'a')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

export function parseGeographyYaml(text: string): GType[] {
  const types: GType[] = [];
  let currentType: GType | null = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    if (line === '') continue;
    if (line.startsWith('- ')) {
      let name = line.slice(2).trim();
      const hasColon = name.endsWith(':');
      if (hasColon) name = name.slice(0, -1).trim();
      if (hasColon) {
        currentType = { id: name, items: [] };
        types.push(currentType);
      } else {
        types.push({ id: name, items: [name] });
        currentType = null;
      }
    } else if (line.startsWith('  - ') && currentType) {
      // A couple of source entries are truncated and carry a stray wrapping
      // double quote (e.g. `"Bonaire`, `"Saint Helena`); strip it so ids/labels
      // are clean and sort correctly.
      currentType.items.push(line.slice(4).trim().replace(/^"+/, '').replace(/"+$/, ''));
    }
  }
  return types;
}

/**
 * Resolve an EEZ name to its parent country/countries. Uses an explicit
 * override when supplied, otherwise strips a trailing " (EEZ)" and matches the
 * remaining name against the known country set. Only countries that exist in
 * `countrySet` are returned, so EEZ for missing countries resolve to [].
 */
export function resolveEezParents(
  eezName: string,
  overrides: Record<string, string[]>,
  countrySet: Set<string>,
): string[] {
  const candidates = overrides[eezName] ?? [eezName.replace(/\s*\(EEZ\)\s*$/, '').trim()];
  return candidates.filter((c) => countrySet.has(c));
}

export function buildSeedSql(
  types: GType[],
  hierarchy: Hierarchy,
  iso3ByCountry: Record<string, string> = countryIso3,
): string {
  for (const sourceName of Object.keys(typeConfig)) {
    if (!types.some((t) => t.id === sourceName)) {
      throw new Error(`YAML contains no type "${sourceName}" — update typeConfig or check the source file.`);
    }
  }

  const itemsByTypeId = (slug: string): string[] => {
    const heading = Object.keys(typeConfig).find((k) => typeConfig[k].id === slug);
    return types.find((t) => t.id === heading)?.items ?? [];
  };
  const countrySet = new Set(itemsByTypeId('admin0'));
  const citySet = new Set(itemsByTypeId('cities'));
  const eezSet = new Set(itemsByTypeId('eez'));
  const basinSet = new Set(itemsByTypeId('river_basins'));
  const continentSet = new Set(hierarchy.continents);

  // A few city-states (Hong Kong, Luxembourg, Singapore) appear as both a
  // country and a city. The id is globally unique, so the city row is suffixed
  // " (City)" to disambiguate — mirroring the " (EEZ)" convention. The label
  // stays the plain name.
  const geographyId = (typeSlug: string, name: string): string =>
    typeSlug === 'cities' && countrySet.has(name) ? `${name} (City)` : name;

  // ---- Validate authored CHILD references (typo guard) ----
  const requireChild = (name: string, set: Set<string>, label: string) => {
    if (!set.has(name)) throw new Error(`Hierarchy references unknown ${label}: "${name}"`);
  };
  for (const [country, continent] of Object.entries(hierarchy.countryContinent)) {
    requireChild(country, countrySet, 'country');
    if (!continentSet.has(continent)) throw new Error(`Country "${country}" maps to unknown continent "${continent}".`);
  }
  for (const city of Object.keys(hierarchy.cityCountry)) requireChild(city, citySet, 'city');
  for (const basin of Object.keys(hierarchy.riverBasinCountries)) requireChild(basin, basinSet, 'river basin');
  for (const eez of Object.keys(hierarchy.eezCountry)) requireChild(eez, eezSet, 'eez');
  // Every country must be grouped under a continent.
  for (const country of countrySet) {
    if (!hierarchy.countryContinent[country]) {
      throw new Error(`Country "${country}" has no continent in countryContinent.`);
    }
  }

  // ---- Build parent edges. Edges to a parent country that is missing from the
  // seed (the YAML omits all "G" countries) are skipped with a warning. ----
  const edges: Array<[string, string]> = [];
  const skipped: string[] = [];
  const addCountryEdge = (child: string, country: string) => {
    if (countrySet.has(country)) edges.push([child, country]);
    else skipped.push(`${child} → ${country}`);
  };

  for (const [country, continent] of Object.entries(hierarchy.countryContinent)) {
    edges.push([country, continentId(continent)]);
  }
  for (const [city, country] of Object.entries(hierarchy.cityCountry)) {
    addCountryEdge(geographyId('cities', city), country);
  }
  for (const [basin, countries] of Object.entries(hierarchy.riverBasinCountries)) {
    for (const country of countries) addCountryEdge(basin, country);
  }
  for (const eez of eezSet) {
    const parents = resolveEezParents(eez, hierarchy.eezCountry, countrySet);
    if (parents.length === 0) skipped.push(`${eez} → (no resolvable country)`);
    for (const country of parents) edges.push([eez, country]);
  }

  if (skipped.length) {
    console.warn(`Skipped ${skipped.length} hierarchy edge(s) with no existing parent:\n  ${skipped.join('\n  ')}`);
  }

  // ---- Emit SQL ----
  const lines: string[] = [
    '-- Auto-generated PROVIDE geographies seed',
    '',
    'DELETE FROM geography_parents;',
    'DELETE FROM geographies;',
    'DELETE FROM geography_types;',
    '',
    '-- Geography types',
  ];

  // continent type first (order -1, not selectable)
  lines.push(
    `INSERT INTO geography_types (id, label, label_singular, "order", is_available, is_selectable) VALUES (${esc(CONTINENT_TYPE.id)}, ${esc(CONTINENT_TYPE.label)}, ${esc(CONTINENT_TYPE.labelSingular)}, -1, true, false);`,
  );
  types.forEach((t, i) => {
    const cfg = typeConfig[t.id];
    if (!cfg) throw new Error(`Unmapped geography type in YAML: "${t.id}" — add it to typeConfig.`);
    lines.push(
      `INSERT INTO geography_types (id, label, label_singular, "order", is_available, is_selectable) VALUES (${esc(cfg.id)}, ${esc(t.id)}, ${esc(cfg.labelSingular)}, ${i}, true, true);`,
    );
  });
  lines.push('');

  lines.push('-- Continent geographies');
  for (const continent of hierarchy.continents) {
    lines.push(`INSERT INTO geographies (id, label, geography_type, geo_id) VALUES (${esc(continentId(continent))}, ${esc(continent)}, 'continent', NULL);`);
  }
  lines.push('');

  for (const t of types) {
    const cfg = typeConfig[t.id];
    lines.push(`-- ${t.id} → ${cfg.id} (${t.items.length} entries)`);
    for (const item of t.items) {
      const geoId = deriveGeoId(cfg.id, item, iso3ByCountry);
      lines.push(`INSERT INTO geographies (id, label, geography_type, geo_id) VALUES (${esc(geographyId(cfg.id, item))}, ${esc(item)}, ${esc(cfg.id)}, ${esc(geoId)});`);
    }
    lines.push('');
  }

  lines.push('-- Hierarchy edges');
  for (const [child, parent] of edges) {
    lines.push(`INSERT INTO geography_parents (geography_id, parent_id) VALUES (${esc(child)}, ${esc(parent)});`);
  }
  lines.push('');

  return lines.join('\n');
}

// ---- CLI ----
if (import.meta.main) {
  const yamlPath = process.argv[2] ?? new URL('./geographies.yaml', import.meta.url).pathname;
  const outPath = process.argv[3] ?? new URL('../seed.sql', import.meta.url).pathname;
  const text = readFileSync(yamlPath, 'utf-8');
  const types = parseGeographyYaml(text);
  const sql = buildSeedSql(types, hierarchyData as unknown as Hierarchy);
  await Bun.write(outPath, sql);
  const total = types.reduce((s, t) => s + t.items.length, 0);
  console.log(`Wrote seed to ${outPath} (${types.length} types, ${total} geographies).`);
}
