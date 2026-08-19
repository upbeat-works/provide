import { describe, expect, test } from 'bun:test';
import { buildImpactGeoRequestConfigs, resolveImpactGeoYear } from './impact-geo-state.js';

describe('resolveImpactGeoYear', () => {
  test('uses the configured default for the first request before years are discovered', () => {
    expect(
      resolveImpactGeoYear({
        currentYear: undefined,
        availableYears: [],
        defaultYear: 2030,
      }),
    ).toBe(2030);
  });

  test('keeps a selected year while it remains available', () => {
    expect(
      resolveImpactGeoYear({
        currentYear: 2050,
        availableYears: [2030, 2050, 2100],
        defaultYear: 2030,
      }),
    ).toBe(2050);
  });

  test('replaces an unavailable year with the default or first available year', () => {
    expect(
      resolveImpactGeoYear({
        currentYear: 2040,
        availableYears: [2030, 2050, 2100],
        defaultYear: 2030,
      }),
    ).toBe(2030);
    expect(
      resolveImpactGeoYear({
        currentYear: 2040,
        availableYears: [2050, 2100],
        defaultYear: 2030,
      }),
    ).toBe(2050);
  });
});

describe('buildImpactGeoRequestConfigs', () => {
  test('sends convention-native selections to the local GeoServer adapter', () => {
    expect(
      buildImpactGeoRequestConfigs({
        base: '/api',
        endpoint: 'impact-geo',
        selection: {
          indicator: 'Mean Temperature',
          geography: 'Cameroon',
          time: 'Annual',
          reference: '2011-2020 (Present Day)',
          spatial: 'Area',
        },
        scenarios: [{ uid: '2020 Climate Policies' }, { uid: 'SSP1-1.9' }],
        year: 2030,
      }),
    ).toEqual([
      {
        base: '/api',
        endpoint: 'impact-geo',
        params: {
          indicator: 'Mean Temperature',
          geography: 'Cameroon',
          time: 'Annual',
          reference: '2011-2020 (Present Day)',
          spatial: 'Area',
          scenario: '2020 Climate Policies',
          year: 2030,
        },
      },
      {
        base: '/api',
        endpoint: 'impact-geo',
        params: {
          indicator: 'Mean Temperature',
          geography: 'Cameroon',
          time: 'Annual',
          reference: '2011-2020 (Present Day)',
          spatial: 'Area',
          scenario: 'SSP1-1.9',
          year: 2030,
        },
      },
    ]);
  });
});
