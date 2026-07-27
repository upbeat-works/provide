import { describe, test, expect } from 'bun:test';
import { toLegacyGeoId, resolveGeo, toLegacyIndicatorUid, resolveIndicator, resolveScenarioUids } from './translate.js';

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
