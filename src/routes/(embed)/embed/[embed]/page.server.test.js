import { expect, test, vi } from 'vitest';
import { load } from './+page.server.js';

test('loads a map embed without requesting a GeoServer layer list', async () => {
  const requestFetch = vi.fn(async () => Response.json({ error: 'GeoServer unavailable' }, { status: 502 }));
  const url = new URL('https://example.test/embed/impact-geo?indicator=Mean%20Temperature&instance=provide-internal&geography=Cameroon&reference=2011-2020%20(Present%20Day)&time=Annual&spatial=Area&scenarios[0]=Low%20Demand&year=2050');
  const result = await load({ fetch: requestFetch, params: { embed: 'impact-geo' }, url });
  expect(result).toEqual({});
  expect(requestFetch).not.toHaveBeenCalled();
});
