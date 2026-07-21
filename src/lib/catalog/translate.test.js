import { describe, test, expect } from 'bun:test';
import { toLegacyGeoId, resolveGeo, toLegacyIndicatorUid, resolveIndicator } from './translate.js';

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
