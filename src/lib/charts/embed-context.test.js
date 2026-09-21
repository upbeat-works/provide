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

  test('builds a canonical map selection from URL metadata without a catalog', () => {
    const result = context(
      'indicator=Mean%20Temperature&instance=provide-internal&geography=Cameroon&geoId=CMR&geographyType=admin0&scenarios[0]=Low%20Demand&time=Annual&reference=2011-2020%20(Present%20Day)&spatial=Area&unit=%C2%B0C'
    );

    expect(result.mapView).toMatchObject({
      status: 'loading',
      selection: { indicator: 'Mean Temperature', instance: 'provide-internal', geography: 'Cameroon', scenarios: ['Low Demand'] },
    });
  });
});
