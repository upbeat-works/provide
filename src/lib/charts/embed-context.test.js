import { describe, expect, test } from 'vitest';
import designTokens from '$styles/color-tokens-light.json';
import { embedChartContext, parseEmbedParams } from './embed-context.js';

function context(query) {
  const params = parseEmbedParams(new URL(`https://provide.example/embed/chart?${query}`));
  return embedChartContext(params, designTokens.category);
}

describe('embed chart URL context', () => {
  test('keeps identity values as strings', () => {
    const result = context('indicator=001&instance=provide-internal&geography=002&scenarios[0]=003');

    expect(result.indicator.uid).toBe('001');
    expect(result.geography.uid).toBe('002');
    expect(result.scenarios[0].uid).toBe('003');
  });

  test('builds a map request from URL metadata without a catalog', () => {
    const result = context(
      'indicator=Annual%20Maximum%20Temperature&instance=provide-internal&geography=Afghanistan&geoId=AFG&geographyType=admin0&scenarios[0]=Low%20Demand&time=Annual&unit=%C2%B0C'
    );

    expect(result.mapView).toMatchObject({
      status: 'ready',
      legacyUrlParams: { indicator: 'terclim-txx', geography: 'AFG', 'geography-type': 'admin0', time: 'annual' },
      scenarioPairs: [{ legacyUid: 'ld' }],
    });
  });
});
