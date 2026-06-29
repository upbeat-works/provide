import { describe, test, expect } from 'bun:test';
import { parseGeographyYaml, buildSeedSql, resolveEezParents, deriveGeoId } from './import-geographies';

const types = [
  { id: 'Countries', items: ['Egypt', 'Sudan'] },
  { id: 'Cities', items: ['Cairo'] },
  { id: 'Exclusive Economic Zones (EEZ)', items: ['Egypt (EEZ)'] },
  { id: 'River Basins (RB)', items: ['Nile'] },
  { id: 'Glacier Regions (GR)', items: ['East Asia (GR)'] },
  { id: 'Macroeconomies (ME)', items: ['East Africa (ME)'] },
  { id: 'Northern Latitudes', items: ['Northern Latitudes'] },
];

const hierarchy = {
  continents: ['Africa'],
  countryContinent: { Egypt: 'Africa', Sudan: 'Africa' },
  cityCountry: { Cairo: 'Egypt' },
  eezCountry: {},
  riverBasinCountries: { Nile: ['Egypt', 'Sudan'] },
};

describe('parseGeographyYaml', () => {
  test('parses headings and items', () => {
    const out = parseGeographyYaml('- Countries:\n  - Egypt\n  - Sudan\n');
    expect(out).toEqual([{ id: 'Countries', items: ['Egypt', 'Sudan'] }]);
  });
});

describe('resolveEezParents', () => {
  test('derives the country by stripping the EEZ suffix', () => {
    expect(resolveEezParents('Egypt (EEZ)', {}, new Set(['Egypt']))).toEqual(['Egypt']);
  });
  test('uses an explicit override when present', () => {
    expect(
      resolveEezParents('Joint area (EEZ)', { 'Joint area (EEZ)': ['Egypt', 'Sudan'] }, new Set(['Egypt', 'Sudan'])),
    ).toEqual(['Egypt', 'Sudan']);
  });
  test('drops candidates that are not existing countries', () => {
    expect(resolveEezParents('Germany (EEZ)', {}, new Set(['Egypt']))).toEqual([]);
  });
});

describe('deriveGeoId', () => {
  const iso3 = { France: 'FRA' };
  test('returns the ISO3 code for a known country', () => {
    expect(deriveGeoId('admin0', 'France', iso3)).toBe('FRA');
  });
  test('returns null for a country absent from the ISO3 table', () => {
    expect(deriveGeoId('admin0', 'Atlantis', iso3)).toBeNull();
  });
  test('slugs a plain city label', () => {
    expect(deriveGeoId('cities', 'Amsterdam', iso3)).toBe('amsterdam');
  });
  test('strips the type suffix before slugging', () => {
    expect(deriveGeoId('river_basins', 'Brahmaputra (RB)', iso3)).toBe('brahmaputra');
    expect(deriveGeoId('glacier_regions', 'Arctic Canada (GR)', iso3)).toBe('arctic_canada');
  });
  test('folds accents and special letters', () => {
    expect(deriveGeoId('cities', 'Bodø', iso3)).toBe('bodo');
  });
  test('keeps commas as the live geo-shape ids do', () => {
    expect(deriveGeoId('glacier_regions', 'Svalbard, Jan Mayen and Russian Arctic (GR)', iso3)).toBe(
      'svalbard,_jan_mayen_and_russian_arctic',
    );
  });
  test('applies a hand-authored override when the live slug differs', () => {
    expect(deriveGeoId('cities', 'Belgrade', iso3)).toBe('belgrado');
    expect(deriveGeoId('river_basins', 'Ysyk Kol (RB)', iso3)).toBe('ysyk-kol');
  });
  test('overrides the standard ISO3 where the map uses a non-standard code', () => {
    const std = { 'Western Sahara': 'ESH', Palestine: 'PSE', 'South Sudan': 'SSD' };
    expect(deriveGeoId('admin0', 'Western Sahara', std)).toBe('SAH');
    expect(deriveGeoId('admin0', 'Palestine', std)).toBe('PSX');
    expect(deriveGeoId('admin0', 'South Sudan', std)).toBe('SDS');
  });
});

describe('buildSeedSql', () => {
  test('emits continents as a non-selectable type', () => {
    const sql = buildSeedSql(types, hierarchy);
    expect(sql).toContain(
      "INSERT INTO geography_types (id, label, label_singular, \"order\", is_available, is_selectable) VALUES ('continent', 'Continents', 'Continent', -1, 1, 0);",
    );
  });

  test('emits a continent geography row with a namespaced id and no geo_id', () => {
    expect(buildSeedSql(types, hierarchy)).toContain(
      "INSERT INTO geographies (id, label, geography_type, geo_id) VALUES ('continent:Africa', 'Africa', 'continent', NULL);",
    );
  });

  test('emits country -> continent parent edges using the namespaced id', () => {
    expect(buildSeedSql(types, hierarchy)).toContain(
      "INSERT INTO geography_parents (geography_id, parent_id) VALUES ('Egypt', 'continent:Africa');",
    );
  });

  test('emits city -> country and derived eez -> country edges', () => {
    const sql = buildSeedSql(types, hierarchy);
    expect(sql).toContain("INSERT INTO geography_parents (geography_id, parent_id) VALUES ('Cairo', 'Egypt');");
    expect(sql).toContain("INSERT INTO geography_parents (geography_id, parent_id) VALUES ('Egypt (EEZ)', 'Egypt');");
  });

  test('emits one edge per country for a trans-boundary basin', () => {
    const sql = buildSeedSql(types, hierarchy);
    expect(sql).toContain("INSERT INTO geography_parents (geography_id, parent_id) VALUES ('Nile', 'Egypt');");
    expect(sql).toContain("INSERT INTO geography_parents (geography_id, parent_id) VALUES ('Nile', 'Sudan');");
  });

  test('suffixes a city id that collides with a country, keeping the plain label', () => {
    const collide = [
      { id: 'Countries', items: ['Singapore'] },
      { id: 'Cities', items: ['Singapore'] },
      { id: 'Exclusive Economic Zones (EEZ)', items: [] },
      { id: 'River Basins (RB)', items: [] },
      { id: 'Glacier Regions (GR)', items: [] },
      { id: 'Macroeconomies (ME)', items: [] },
      { id: 'Northern Latitudes', items: ['Northern Latitudes'] },
    ];
    const h = {
      continents: ['Asia'],
      countryContinent: { Singapore: 'Asia' },
      cityCountry: { Singapore: 'Singapore' },
      eezCountry: {},
      riverBasinCountries: {},
    };
    const sql = buildSeedSql(collide, h, { Singapore: 'SGP' });
    expect(sql).toContain("INSERT INTO geographies (id, label, geography_type, geo_id) VALUES ('Singapore', 'Singapore', 'admin0', 'SGP');");
    expect(sql).toContain("INSERT INTO geographies (id, label, geography_type, geo_id) VALUES ('Singapore (City)', 'Singapore', 'cities', 'singapore');");
    expect(sql).toContain("INSERT INTO geography_parents (geography_id, parent_id) VALUES ('Singapore (City)', 'Singapore');");
  });

  test('emits an ISO3 geo_id for a country', () => {
    const sql = buildSeedSql(types, hierarchy, { Egypt: 'EGY', Sudan: 'SDN' });
    expect(sql).toContain(
      "INSERT INTO geographies (id, label, geography_type, geo_id) VALUES ('Egypt', 'Egypt', 'admin0', 'EGY');",
    );
  });

  test('throws when a mapping references an unknown child', () => {
    const bad = { ...hierarchy, cityCountry: { Atlantis: 'Egypt' } };
    expect(() => buildSeedSql(types, bad)).toThrow(/Atlantis/);
  });

  test('throws when a country has no continent', () => {
    const bad = { ...hierarchy, countryContinent: { Egypt: 'Africa' } };
    expect(() => buildSeedSql(types, bad)).toThrow(/Sudan/);
  });

  test('skips (does not throw) an edge to a parent country missing from the seed', () => {
    const bad = { ...hierarchy, cityCountry: { Cairo: 'Atlantis' } };
    const sql = buildSeedSql(types, bad);
    expect(sql).not.toContain("VALUES ('Cairo', 'Atlantis')");
  });
});
