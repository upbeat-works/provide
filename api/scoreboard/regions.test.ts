import { describe, expect, test } from 'vitest';
import { childRegionsFromCatalog, worldR9Regions } from './regions';

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
