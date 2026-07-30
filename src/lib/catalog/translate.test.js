import { describe, test, expect } from 'bun:test';
import { toLegacyGeoId, resolveGeo, toLegacyIndicatorUid, resolveIndicator, resolveScenarioUids, toLegacyScenarioUid, toLegacyScenarioUids, toLegacyParameterValues } from './translate.js';

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

  test('resolveGeo matches by uid or geoId', () => {
    expect(resolveGeo('Accra', GEOS)?.geoId).toBe('accra');
    expect(resolveGeo('accra', GEOS)?.uid).toBe('Accra');
    expect(resolveGeo('nope', GEOS)).toBeUndefined();
  });

  test('toLegacyIndicatorUid returns legacyUid, undefined when unmapped', () => {
    expect(toLegacyIndicatorUid('Mean daily temperature', INDS)).toBe('urbclim-T2M-mean');
    expect(toLegacyIndicatorUid('Glacier area', INDS)).toBeUndefined();
  });

  test('resolveIndicator matches by uid or legacyUid', () => {
    expect(resolveIndicator('urbclim-T2M-mean', INDS)?.uid).toBe('Mean daily temperature');
    expect(resolveIndicator('Mean daily temperature', INDS)?.legacyUid).toBe('urbclim-T2M-mean');
    expect(resolveIndicator('nope', INDS)).toBeUndefined();
  });
});

describe('resolveScenarioUids', () => {
  const scenarios = [{ uid: '2020 Climate Policies' }, { uid: 'SSP5-3.4-OS' }, { uid: 'Shifting Pathway' }];

  test('keeps known scenarios, in the order given', () => {
    expect(resolveScenarioUids(['SSP5-3.4-OS', '2020 Climate Policies'], scenarios)).toEqual(['SSP5-3.4-OS', '2020 Climate Policies']);
  });

  test('canonicalises casing to the catalog spelling', () => {
    expect(resolveScenarioUids(['ssp5-3.4-os'], scenarios)).toEqual(['SSP5-3.4-OS']);
  });

  test('drops scenarios the catalog does not have', () => {
    expect(resolveScenarioUids(['curpol', 'SSP5-3.4-OS'], scenarios)).toEqual(['SSP5-3.4-OS']);
  });

  test('drops duplicates', () => {
    expect(resolveScenarioUids(['SSP5-3.4-OS', 'ssp5-3.4-os'], scenarios)).toEqual(['SSP5-3.4-OS']);
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
  test('maps every convention scenario onto its 2100 legacy twin', () => {
    expect(toLegacyScenarioUid('2020 Climate Policies')).toBe('curpol');
    expect(toLegacyScenarioUid('2020 Climate Targets')).toBe('modact');
    expect(toLegacyScenarioUid('Delayed Climate Action')).toBe('gs');
    expect(toLegacyScenarioUid('High Negative Emissions')).toBe('neg');
    expect(toLegacyScenarioUid('High Renewables')).toBe('ren');
    expect(toLegacyScenarioUid('Low Demand')).toBe('ld');
    expect(toLegacyScenarioUid('Shifting Pathway')).toBe('sp');
    expect(toLegacyScenarioUid('SSP1-1.9')).toBe('ssp119');
    expect(toLegacyScenarioUid('SSP5-3.4-OS')).toBe('ssp534-over');
    expect(toLegacyScenarioUid('Stabilisation At 1.5°C')).toBe('ref-1p5');
  });

  test('never picks an -extended (2300) variant', () => {
    const mapped = ['SSP1-1.9', 'SSP5-3.4-OS', 'Stabilisation At 1.5°C'].map(toLegacyScenarioUid);
    expect(mapped.some((uid) => uid.endsWith('-extended'))).toBe(false);
  });

  test('matches case-insensitively, for ixmp4 case-only duplicate runs', () => {
    expect(toLegacyScenarioUid('ssp5-3.4-os')).toBe('ssp534-over');
    expect(toLegacyScenarioUid('stabilisation at 1.5°C')).toBe('ref-1p5');
  });

  test('has no legacy twin for the Today baseline or an unknown name', () => {
    expect(toLegacyScenarioUid('Today')).toBeUndefined();
    expect(toLegacyScenarioUid('Invented Scenario')).toBeUndefined();
    expect(toLegacyScenarioUid(undefined)).toBeUndefined();
  });
});

describe('toLegacyScenarioUids', () => {
  test('translates in order and drops the unmappable', () => {
    expect(toLegacyScenarioUids(['SSP5-3.4-OS', 'Today', 'Low Demand'])).toEqual(['ssp534-over', 'ld']);
  });

  test('accepts a single value and tolerates missing input', () => {
    expect(toLegacyScenarioUids('Low Demand')).toEqual(['ld']);
    expect(toLegacyScenarioUids()).toEqual([]);
  });
});

describe('toLegacyParameterValues', () => {
  test('translates the whole selectable parameter universe', () => {
    expect(
      toLegacyParameterValues({ time: 'Annual', reference: '2011-2020 (Present Day)', spatial: 'Area' })
    ).toEqual({ time: 'annual', reference: 'present-day', spatial: 'area' });
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
