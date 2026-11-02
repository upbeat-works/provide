import { expect, test, vi } from 'vitest';
import { POST } from './[...resource]/+server.js';

vi.mock('$utils/apis.js', () => ({ catalogApiUrl: (path) => `http://api.test/api/${path}`, loadFromStrapi: vi.fn() }));

const event = (resource, fetch) => ({
  params: { resource }, fetch,
  url: new URL(`http://web.test/app/scoreboard/preview/${resource}?sector=preview&scenario=Draft&region=Austria&year=2050`),
  request: new Request('http://web.test', { method: 'POST', body: '{"label":"Draft"}' }),
});

test('forwards a draft and selections to the API without putting JSON in the URL', async () => {
  const fetch = vi.fn(async () => Response.json({ error: 'map.years must contain four-digit numbers' }, { status: 400 }));
  const response = await POST(event('definition', fetch));
  expect(fetch).toHaveBeenCalledWith('http://api.test/api/scoreboard/definition?sector=preview&scenario=Draft&region=Austria&year=2050', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"label":"Draft"}',
  });
  expect(response.status).toBe(400);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ error: 'map.years must contain four-digit numbers' });
});

test('supports chart IDs with spaces and returns chart data', async () => {
  const result = { status: 'ready', definition: { chartId: 'Heat chart' }, data: [] };
  const fetch = vi.fn(async () => Response.json(result));
  const response = await POST(event('charts/Heat chart', fetch));
  expect(fetch.mock.calls[0][0]).toContain('/charts/Heat%20chart?');
  expect(await response.json()).toEqual(result);
});

test('does not proxy unrelated resources', async () => {
  const fetch = vi.fn();
  expect((await POST(event('../indicators', fetch))).status).toBe(404);
  expect(fetch).not.toHaveBeenCalled();
});
