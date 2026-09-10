import { describe, test, expect } from 'vitest';
import {
  toLegacyGeoId,
  toLegacyMapIndicatorUid,
  toLegacyAvoidIndicatorUid,
  canonicalAvoidIndicatorUid,
  resolveCanonicalAvoidUrlSelection,
  resolveGeo,
  resolveIndicator,
  resolveScenarioUids,
  toLegacyScenarioUid,
  toLegacyScenarioUids,
  toLegacyParameterValues,
  canonicalAvoidParameterValues,
  toLegacyAvoidRequest,
  canonicalAvoidShareSelection,
} from './translate.js';

const GEOS = [
  { uid: 'Afghanistan', label: 'Afghanistan', geoId: 'AFG' },
  { uid: 'Accra', label: 'Accra', geoId: 'accra' },
];
const INDS = [
  { uid: 'Mean daily temperature', legacyUid: 'urbclim-T2M-mean' },
  { uid: 'Glacier area' }, // no legacyUid
];

describe('translate', () => {
  test('toLegacyGeoId returns geoId', () => {
    expect(toLegacyGeoId(GEOS[1])).toBe('accra');
    expect(toLegacyGeoId(undefined)).toBeUndefined();
  });

  test('resolveGeo accepts only the canonical ID', () => {
    expect(resolveGeo('Accra', GEOS)?.geoId).toBe('accra');
    expect(resolveGeo('accra', GEOS)).toBeUndefined();
    expect(resolveGeo('nope', GEOS)).toBeUndefined();
  });

  test('map and avoiding boundaries translate a source-bound canonical indicator without public legacy fields', () => {
    expect(toLegacyMapIndicatorUid({ id: 'Heatwave Days per Year', instance: 'provide-internal' })).toBe('urbclim-heatwave-days');
    expect(toLegacyMapIndicatorUid({ id: 'Mean Temperature', instance: 'provide-internal' })).toBe('terclim-mean-temperature');
    expect(toLegacyMapIndicatorUid({ id: 'Heatwave Days per Year', instance: 'provide-external' })).toBeUndefined();
    expect(toLegacyAvoidIndicatorUid('Heatwave Days per Year')).toBe('urbclim-heatwave-days');
    expect(canonicalAvoidIndicatorUid('urbclim-heatwave-days')).toBe('Heatwave Days per Year');
    expect(toLegacyAvoidIndicatorUid('urbclim-heatwave-days')).toBeUndefined();
  });

  test('resolveIndicator accepts only the canonical ID', () => {
    expect(resolveIndicator('urbclim-T2M-mean', INDS)).toBeUndefined();
    expect(resolveIndicator('Mean daily temperature', INDS)?.legacyUid).toBe('urbclim-T2M-mean');
    expect(resolveIndicator('nope', INDS)).toBeUndefined();
  });

  test('keeps URL selection canonical and translates only the old avoiding request', () => {
    const cities = [{ uid: 'Lisbon', label: 'Lisbon', geoId: 'lisbon' }];
    expect(resolveCanonicalAvoidUrlSelection({ geography: 'Lisbon', indicator: 'Heatwave Days per Year', instance: 'provide-internal' }, cities)).toEqual({
      geography: 'Lisbon',
      indicator: 'Heatwave Days per Year',
      instance: 'provide-internal',
    });
    expect(resolveCanonicalAvoidUrlSelection({ geography: 'lisbon', indicator: 'urbclim-heatwave-days' }, cities)).toBeUndefined();
    expect(
      toLegacyAvoidRequest({
        geography: cities[0],
        indicator: { id: 'Heatwave Days per Year', instance: 'provide-internal' },
        scenarios: ['2020 Climate Policies'],
        parameters: { time: 'Annual', reference: '2011-2020 (Present Day)', spatial: 'Area' },
      })
    ).toEqual({
      geography: 'lisbon',
      indicator: 'urbclim-heatwave-days',
      scenarios: ['curpol'],
      time: 'annual',
      reference: 'present-day',
      spatial: 'area',
    });
    expect(
      canonicalAvoidShareSelection({
        geography: cities[0],
        indicator: { id: 'Heatwave Days per Year', instance: 'provide-external' },
        parameters: { reference: '2011-2020 (Present Day)' },
      })
    ).toEqual({
      geography: 'Lisbon',
      indicator: 'Heatwave Days per Year',
      instance: 'provide-external',
      reference: '2011-2020 (Present Day)',
    });
  });

  test('resolves a canonical city label from raw avoid loader cities', () => {
    expect(resolveCanonicalAvoidUrlSelection({ geography: 'Lisbon', indicator: 'Heatwave Days per Year', instance: 'provide-internal' }, [{ uid: 'lisbon', label: 'Lisbon' }])).toEqual({
      geography: 'Lisbon',
      indicator: 'Heatwave Days per Year',
      instance: 'provide-internal',
    });
  });

  test('rejects a canonical URL pair outside the Avoid metadata source', () => {
    expect(resolveCanonicalAvoidUrlSelection({ geography: 'Lisbon', indicator: 'Heatwave Days per Year', instance: 'provide-external' }, [{ uid: 'lisbon', label: 'Lisbon' }])).toBeUndefined();
  });

  test('does not translate an external indicator instance at the old avoiding boundary', () => {
    expect(
      toLegacyAvoidRequest({
        geography: { id: 'Lisbon', geoId: 'lisbon' },
        indicator: { id: 'Heatwave Days per Year', instance: 'provide-external' },
      })
    ).toBeUndefined();
  });
});

describe('resolveScenarioUids', () => {
  const scenarios = [{ uid: '2020 Climate Policies' }, { uid: 'SSP5-3.4-OS' }, { uid: 'Shifting Pathway' }];

  test('keeps known scenarios, in the order given', () => {
    expect(resolveScenarioUids(['SSP5-3.4-OS', '2020 Climate Policies'], scenarios)).toEqual(['SSP5-3.4-OS', '2020 Climate Policies']);
  });

  test('requires the canonical scenario spelling', () => {
    expect(resolveScenarioUids(['ssp5-3.4-os'], scenarios)).toEqual([]);
  });

  test('drops scenarios the catalog does not have', () => {
    expect(resolveScenarioUids(['curpol', 'SSP5-3.4-OS'], scenarios)).toEqual(['SSP5-3.4-OS']);
  });

  test('drops duplicates', () => {
    expect(resolveScenarioUids(['SSP5-3.4-OS', 'SSP5-3.4-OS'], scenarios)).toEqual(['SSP5-3.4-OS']);
  });

  test('caps at the maximum selectable', () => {
    const many = [{ uid: 'a' }, { uid: 'b' }, { uid: 'c' }, { uid: 'd' }];
    expect(resolveScenarioUids(['a', 'b', 'c', 'd'], many)).toEqual(['a', 'b', 'c']);
  });

  test('accepts a single string as well as an array', () => {
    expect(resolveScenarioUids('SSP5-3.4-OS', scenarios)).toEqual(['SSP5-3.4-OS']);
  });

  test('tolerates missing input', () => {
    expect(resolveScenarioUids(undefined, scenarios)).toEqual([]);
    expect(resolveScenarioUids(['SSP5-3.4-OS'], [])).toEqual([]);
    expect(resolveScenarioUids([], scenarios)).toEqual([]);
  });
});

describe('toLegacyScenarioUid', () => {
  test('maps the complete canonical scenario list to distinct legacy runs', () => {
    const pairs = [
      ['2020 Climate Policies', 'curpol'],
      ['2020 Climate Policies then back to 1.5 °C', 'curpol-os'],
      ['2020 Climate Policies then Stabilisation', 'curpol-sap'],
      ['Delayed Climate Action', 'gs'],
      ['Delayed Climate Action then Net Zero', 'gs-nzghg'],
      ['Shifting Pathway', 'sp'],
      ['Shifting Pathway then Net Zero', 'sp-nzghg'],
      ['2020 Climate Targets', 'modact'],
      ['2020 Climate Targets then back to 1.5 °C', 'modact-os-1.5c'],
      ['2020 Climate Targets then back to 1 °C', 'modact-os-1c'],
      ['2020 Climate Targets then Stabilisation', 'modact-sap'],
      ['High Negative Emissions', 'neg'],
      ['High Negative Emissions then Net Zero', 'neg-nzghg'],
      ['High Negative Emissions then back to 0 °C', 'neg-os-0'],
      ['High Negative Emissions then Stabilisation', 'neg-sap'],
      ['High Renewables', 'ren'],
      ['High Renewables then Net Zero CO2', 'ren-nzco2'],
      ['Low Demand', 'ld'],
      ['Low Demand then Net Zero', 'ld-nzghg'],
      ['SSP1-1.9', 'ssp119'],
      ['SSP1-1.9 (Extended)', 'ssp119-extended'],
      ['SSP5-3.4-Overshoot', 'ssp534-over'],
      ['SSP5-3.4-Overshoot (Extended)', 'ssp534-over-extended'],
      ['Stabilisation at 1.5 °C', 'ref-1p5'],
      ['Stabilisation at 1.5 °C (Extended)', 'ref-1p5-extended'],
    ];

    expect(pairs.map(([name]) => toLegacyScenarioUid(name))).toEqual(pairs.map(([, uid]) => uid));
    expect(new Set(pairs.map(([name]) => toLegacyScenarioUid(name))).size).toBe(25);
  });

  test('does not accept replaced scenario names as runtime aliases', () => {
    expect(toLegacyScenarioUid('SSP5-3.4-OS')).toBeUndefined();
    expect(toLegacyScenarioUid('Stabilisation At 1.5°C')).toBeUndefined();
  });

  test('has no legacy twin for the Today baseline or an unknown name', () => {
    expect(toLegacyScenarioUid('Today')).toBeUndefined();
    expect(toLegacyScenarioUid('Invented Scenario')).toBeUndefined();
    expect(toLegacyScenarioUid('toString')).toBeUndefined();
    expect(toLegacyScenarioUid('__proto__')).toBeUndefined();
    expect(toLegacyScenarioUid(undefined)).toBeUndefined();
  });
});

describe('toLegacyScenarioUids', () => {
  test('translates in order and drops the unmappable', () => {
    expect(toLegacyScenarioUids(['SSP5-3.4-Overshoot', 'Today', 'Low Demand'])).toEqual(['ssp534-over', 'ld']);
  });

  test('accepts a single value and tolerates missing input', () => {
    expect(toLegacyScenarioUids('Low Demand')).toEqual(['ld']);
    expect(toLegacyScenarioUids()).toEqual([]);
  });
});

describe('toLegacyParameterValues', () => {
  test('translates the whole selectable parameter universe', () => {
    expect(toLegacyParameterValues({ time: 'Annual', reference: '2011-2020 (Present Day)', spatial: 'Area' })).toEqual({ time: 'annual', reference: 'present-day', spatial: 'area' });
  });

  test('translates every season and the pre-industrial reference', () => {
    expect(toLegacyParameterValues({ time: 'December - February' }).time).toBe('djf');
    expect(toLegacyParameterValues({ time: 'March - May' }).time).toBe('mam');
    expect(toLegacyParameterValues({ time: 'June - August' }).time).toBe('jja');
    expect(toLegacyParameterValues({ time: 'September - November' }).time).toBe('son');
    expect(toLegacyParameterValues({ reference: '1850-1900 (Pre-industrial)' }).reference).toBe('pre-industrial');
  });

  test('omits a known dimension holding an unmappable value, so the legacy default applies', () => {
    expect(toLegacyParameterValues({ time: 'Hourly', spatial: 'Area' })).toEqual({ spatial: 'area' });
  });

  test('passes through dimensions it does not translate', () => {
    // frequency/indicator_value are already legacy-shaped values.
    expect(toLegacyParameterValues({ frequency: '0.05', indicator_value: '35' })).toEqual({
      frequency: '0.05',
      indicator_value: '35',
    });
  });

  test('tolerates missing input', () => {
    expect(toLegacyParameterValues()).toEqual({});
    expect(toLegacyParameterValues(undefined)).toEqual({});
  });
});

describe('canonicalAvoidParameterValues', () => {
  test('writes canonical values into avoid share links', () => {
    expect(canonicalAvoidParameterValues({ time: 'annual', reference: 'present-day', spatial: 'area', indicator_value: '28' })).toEqual({
      time: 'Annual',
      reference: '2011-2020 (Present Day)',
      spatial: 'Area',
      indicator_value: '28',
    });
  });

  test('maps the legacy metadata reference value to the canonical present-day period', () => {
    expect(canonicalAvoidParameterValues({ reference: 'absolute' })).toEqual({ reference: '2011-2020 (Present Day)' });
  });
});
