import { describe, expect, test } from 'vitest';
import { childRegionsFromCatalog, mapMembers, mapRegionOptions, worldR9Regions } from './regions';

describe('scoreboard region membership', () => {
  test('uses only direct catalog parent edges', () => {
    const geographies = [{ id: 'Europe', label: 'Europe', geographyType: 'continent' }, { id: 'Austria', label: 'Austria', geographyType: 'admin0' }, { id: 'Vienna', label: 'Vienna', geographyType: 'cities' }, { id: 'France', label: 'France', geographyType: 'admin0' }];
    const parents = [{ geographyId: 'Austria', parentId: 'Europe' }, { geographyId: 'Vienna', parentId: 'Austria' }];
    expect(childRegionsFromCatalog('Europe', geographies, parents)).toEqual([{ uid: 'Austria', label: 'Austria' }]);
  });

  test('uses the nine common R9 regions as the World partition', () => {
    const regions = worldR9Regions();
    expect(regions).toHaveLength(9);
    expect(regions).toContainEqual({ uid: 'European Union (R9)', label: 'European Union (R9)' });
  });
});

describe('map region choices', () => {
  const catalog = {
    geographies: [
      { id: 'continent:Europe', label: 'Europe', geographyType: 'continent', geoId: null },
      { id: 'Austria', label: 'Austria', geographyType: 'admin0', geoId: 'AUT' },
      { id: 'France', label: 'France', geographyType: 'admin0', geoId: 'FRA' },
    ],
    parents: [
      { geographyId: 'Austria', parentId: 'continent:Europe' },
      { geographyId: 'France', parentId: 'continent:Europe' },
    ],
  } as unknown as Parameters<typeof mapRegionOptions>[2];
  const available = new Set(['Austria', 'France']);

  test('offers the country map its continents and countries, but never World', () => {
    // The country map is drawn from NUTS, which stops at Europe — a world
    // option would name a view that does not exist.
    const options = mapRegionOptions('admin0', available, catalog);
    expect(options.map(({ uid }) => uid)).toEqual(['continent:Europe', 'Austria', 'France']);
  });

  test('keeps World for the R9 map, which is global', () => {
    const options = mapRegionOptions('r9', new Set(['European Union (R9)']), catalog);
    expect(options).toEqual([
      { uid: 'World', label: 'World' },
      { uid: 'European Union (R9)', label: 'European Union (R9)' },
    ]);
  });

  test('draws nothing for a World the country map never offered', () => {
    // A stale URL can still carry it; it must not fall through to the R9 names.
    expect(mapMembers('admin0', 'World', catalog)).toEqual([]);
    expect(mapMembers('r9', 'World', catalog)).toHaveLength(9);
  });

  test('maps a continent as its countries and a country as itself', () => {
    expect(mapMembers('admin0', 'continent:Europe', catalog).map(({ uid }) => uid)).toEqual(['Austria', 'France']);
    expect(mapMembers('admin0', 'France', catalog)).toEqual([{ uid: 'France', label: 'France' }]);
  });
});
