import { expect, test, vi } from 'vitest';
import { load } from './+page.server.js';

test('loads canonical map availability for an image embed', async () => {
  const requestFetch = vi.fn(async () => Response.json({ scenarios: { 'Low Demand': [2030, 2050] } }));
  const url = new URL('https://example.test/embed/impact-geo?indicator=Mean%20Temperature&instance=provide-internal&geography=Cameroon&reference=2011-2020%20(Present%20Day)&time=Annual&spatial=Area&scenarios[0]=Low%20Demand&year=2050');
  const result = await load({ fetch: requestFetch, params: { embed: 'impact-geo' }, url });
  expect(result.mapView).toMatchObject({ status: 'ready', years: [2030, 2050], selection: { instance: 'provide-internal', scenarios: ['Low Demand'] } });
  // The loader fetches a relative path, as a SvelteKit load should; resolve it
  // against the page url to inspect the pathname.
  const requested = new URL(requestFetch.mock.calls[0][0], url);
  expect(requested.pathname).toBe('/api/impact-geo/availability/');
});

test('rejects an unsupported map threshold before loading availability', async () => {
  const requestFetch = vi.fn();
  const url = new URL('https://example.test/embed/impact-geo?indicator=Mean%20Temperature&instance=provide-internal&geography=Cameroon&reference=Present&time=Annual&spatial=Area&threshold=95th%20Percentile&scenarios[0]=Low%20Demand');
  const result = await load({ fetch: requestFetch, params: { embed: 'impact-geo' }, url });
  expect(result.mapView).toEqual({ status: 'empty' });
  expect(requestFetch).not.toHaveBeenCalled();
});
