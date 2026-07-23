import { describe, test, expect } from 'bun:test';
import { buildIndex, childSummary, geoIdOf, parentCountriesOf, continentOf, childGroups } from './geography-tree.js';

const geographies = {
  continent: [{ uid: 'Africa', label: 'Africa', geographyType: 'continent', parents: [] }],
  admin0: [
    { uid: 'Egypt', label: 'Egypt', geographyType: 'admin0', geoId: 'EGY', parents: ['Africa'] },
    { uid: 'Sudan', label: 'Sudan', geographyType: 'admin0', geoId: 'SDN', parents: ['Africa'] },
  ],
  cities: [{ uid: 'Cairo', label: 'Cairo', geographyType: 'cities', geoId: 'cairo', parents: ['Egypt'] }],
  river_basins: [{ uid: 'Nile', label: 'Nile', geographyType: 'river_basins', geoId: 'nile', parents: ['Egypt', 'Sudan'] }],
};

describe('buildIndex', () => {
  test('indexes geographies by id', () => {
    const { byId } = buildIndex(geographies);
    expect(byId['Cairo'].label).toBe('Cairo');
  });

  test('groups children by parent and type', () => {
    const { childrenByParent } = buildIndex(geographies);
    expect(childrenByParent['Egypt'].cities.map((c) => c.uid)).toEqual(['Cairo']);
    expect(childrenByParent['Egypt'].river_basins.map((c) => c.uid)).toEqual(['Nile']);
  });

  test('a trans-boundary basin appears under each parent country', () => {
    const { childrenByParent } = buildIndex(geographies);
    expect(childrenByParent['Sudan'].river_basins.map((c) => c.uid)).toEqual(['Nile']);
  });

  test('groups countries under their continent, sorted by label', () => {
    const { countriesByContinent } = buildIndex(geographies);
    expect(countriesByContinent['Africa'].map((c) => c.uid)).toEqual(['Egypt', 'Sudan']);
  });

  test('tolerates an empty / undefined input', () => {
    expect(buildIndex(undefined)).toEqual({ byId: {}, childrenByParent: {}, countriesByContinent: {} });
  });
});

describe('geoIdOf', () => {
  const index = buildIndex(geographies);
  test('returns the geoId for a known geography', () => {
    expect(geoIdOf(index, 'Egypt')).toBe('EGY');
    expect(geoIdOf(index, 'Cairo')).toBe('cairo');
  });
  test('returns null for a continent (no geoId)', () => {
    expect(geoIdOf(index, 'Africa')).toBeNull();
  });
  test('returns null for an unknown or empty uid', () => {
    expect(geoIdOf(index, 'Atlantis')).toBeNull();
    expect(geoIdOf(index, undefined)).toBeNull();
  });
});

describe('parentCountriesOf', () => {
  const index = buildIndex(geographies);
  test('returns all admin0 parents for a transboundary child', () => {
    expect(parentCountriesOf(index, 'Nile').map((c) => c.uid)).toEqual(['Egypt', 'Sudan']);
  });
  test('returns the single country parent for a city', () => {
    expect(parentCountriesOf(index, 'Cairo').map((c) => c.uid)).toEqual(['Egypt']);
  });
  test('ignores non-country parents (continents)', () => {
    expect(parentCountriesOf(index, 'Egypt')).toEqual([]); // Egypt's parent is the continent Africa
  });
  test('returns [] for an unknown uid', () => {
    expect(parentCountriesOf(index, 'Atlantis')).toEqual([]);
  });
});

describe('continentOf', () => {
  const index = buildIndex(geographies);
  test('returns the continent parent of a country', () => {
    expect(continentOf(index, 'Egypt')?.uid).toBe('Africa');
  });
  test('returns null when there is no continent parent', () => {
    expect(continentOf(index, 'Cairo')).toBeNull(); // Cairo's parent is Egypt (a country)
  });
  test('returns null for an unknown uid', () => {
    expect(continentOf(index, 'Atlantis')).toBeNull();
  });
});

describe('childGroups', () => {
  const index = buildIndex(geographies);
  test('returns child objects grouped by type in display order', () => {
    expect(childGroups(index, 'Egypt')).toEqual([
      { type: 'cities', items: [index.byId['Cairo']] },
      { type: 'river_basins', items: [index.byId['Nile']] },
    ]);
  });
  test('returns only the types that have children', () => {
    expect(childGroups(index, 'Sudan')).toEqual([
      { type: 'river_basins', items: [index.byId['Nile']] },
    ]);
  });
  test('returns [] for a geography with no children', () => {
    expect(childGroups(index, 'Cairo')).toEqual([]);
  });
});

describe('childSummary', () => {
  test('returns child types and counts for a country in display order', () => {
    const index = buildIndex(geographies);
    expect(childSummary(index, 'Egypt')).toEqual([
      { type: 'cities', count: 1 },
      { type: 'river_basins', count: 1 },
    ]);
  });

  test('returns only the types that have children', () => {
    const index = buildIndex(geographies);
    expect(childSummary(index, 'Sudan')).toEqual([{ type: 'river_basins', count: 1 }]);
  });

  test('returns an empty array for a country with no children', () => {
    const index = buildIndex(geographies);
    expect(childSummary(index, 'Africa')).toEqual([]);
  });
});
