import { expect, test } from 'bun:test';
import { buildDataUrl } from './url.js';

test('uses a chart-specific API base and repeated array parameters', () => {
  expect(
    buildDataUrl({
      endpoint: 'impact-geo',
      params: { scenario: 'curpol', scenarios: ['curpol', 'sp'] },
      base: '/api',
      fallbackBase: 'https://provide-api.iiasa.ac.at/api',
      arrayFormat: 'repeat',
    }),
  ).toBe('/api/impact-geo/?scenario=curpol&scenarios=curpol&scenarios=sp');
});

test('falls back to the legacy API when no chart-specific base is configured', () => {
  expect(
    buildDataUrl({
      endpoint: 'geo-shape',
      params: { geography: 'CMR' },
      fallbackBase: 'https://provide-api.iiasa.ac.at/api',
    }),
  ).toBe('https://provide-api.iiasa.ac.at/api/geo-shape/?geography=CMR');
});
