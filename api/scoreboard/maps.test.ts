import { describe, expect, test } from 'vitest';
import { countryMapValues, r9MapValues } from './maps';

const rows = [
  { scenario: 's', region: 'Austria', '2050': 0 },
  { scenario: 's', region: 'France', '2050': 2 },
  { scenario: 's', region: 'European Union (R9)', '2050': 3 },
  { scenario: 's', region: 'Other (R9)', '2050': 4 },
];

describe('scoreboard map values', () => {
  test('maps country names to alpha-3 IDs and keeps zero', () => {
    const geographies = [
      { id: 'Austria', label: 'Austria', geographyType: 'admin0', geoId: 'AUT' },
      { id: 'France', label: 'France', geographyType: 'admin0', geoId: 'FRA' },
    ];
    expect(countryMapValues(rows, geographies, 's', 2050, new Set(['Austria', 'France']))).toEqual([
      { uid: 'AUT', label: 'Austria', value: 0 }, { uid: 'FRA', label: 'France', value: 2 },
    ]);
  });

  test('maps only exact common R9 regions', () => {
    expect(r9MapValues(rows, 's', 2050, new Set(['European Union (R9)', 'Other (R9)']))).toEqual([
      { uid: 'European Union (R9)', label: 'European Union (R9)', value: 3 },
    ]);
  });
});
