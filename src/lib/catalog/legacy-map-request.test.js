import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { legacyMapRequestParams, legacyMapView } from './legacy-map-request.js';

describe('legacy map request boundary', () => {
  test('hides a confirmed selection with no legacy indicator mapping', () => {
    expect(
      legacyMapView({
        chartView: { status: 'ready' },
        geography: { id: 'Afghanistan', geoId: 'AFG', geographyType: 'admin0' },
        indicator: { id: 'Unsupported Indicator', instance: 'provide-internal' },
        scenarios: [{ uid: 'Low Demand' }],
        optionValues: {},
      })
    ).toEqual({ status: 'empty' });
  });

  test.each([
    [{ status: 'loading' }, { status: 'loading' }],
    [
      { status: 'failure', failedRequest: 'availability' },
      { status: 'failure', failedRequest: 'availability' },
    ],
  ])('preserves unresolved chart feedback before checking legacy mappings', (chartView, expected) => {
    expect(legacyMapView({ chartView })).toEqual(expected);
  });

  test.each([
    [{ id: 'Afghanistan', geographyType: 'admin0' }, [{ uid: 'Low Demand' }]],
    [{ id: 'Afghanistan', geoId: 'AFG', geographyType: 'admin0' }, [{ uid: 'Unknown' }]],
  ])('hides a confirmed selection without a mapped geography and scenario combination', (geography, scenarios) => {
    expect(
      legacyMapView({
        chartView: { status: 'ready' },
        geography,
        indicator: { id: 'Annual Maximum Temperature', instance: 'provide-internal' },
        scenarios,
      })
    ).toEqual({ status: 'empty' });
  });

  test('keeps mapped scenarios paired with their source rows', () => {
    const mapped = { uid: 'Low Demand', color: '#123' };
    expect(
      legacyMapView({
        chartView: { status: 'ready' },
        geography: { id: 'Afghanistan', geoId: 'AFG', geographyType: 'admin0' },
        indicator: { id: 'Annual Maximum Temperature', instance: 'provide-internal' },
        scenarios: [{ uid: 'Unknown' }, mapped],
        optionValues: { reference: '2011-2020 (Present Day)' },
      })
    ).toMatchObject({
      status: 'ready',
      legacyUrlParams: { geography: 'AFG', indicator: 'terclim-txx', reference: 'present-day' },
      scenarioPairs: [{ scenario: mapped, legacyUid: 'ld' }],
    });
  });

  test('maps every curated indicator to the matching old map request', () => {
    const catalog = readFileSync(new URL('../../../api/db/import/indicators.yaml', import.meta.url), 'utf8');
    const entries = [...catalog.matchAll(/^- id: (.+)\n  sector: .+\n  legacyUid: (.+)$/gm)];
    expect(entries.length).toBeGreaterThan(0);
    for (const [, id, legacyId] of entries) {
      const params = legacyMapRequestParams({
        geography: { id: 'Algeria', geoId: 'DZA', geographyType: 'admin0' },
        indicator: { id, instance: 'provide-internal' },
        optionValues: {},
      });
      expect(params.indicator, id).toBe(legacyId);
    }
  });
});
