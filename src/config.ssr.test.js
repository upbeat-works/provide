import { afterAll, beforeAll, expect, test } from 'vitest';
import { createServer } from 'vite';

let vite;

beforeAll(async () => {
  vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, hmr: false },
  });
  await vite.listen();
});

afterAll(async () => vite?.close());

test('serves the shared projection settings to the browser in development', async () => {
  const { port } = vite.httpServer.address();
  const response = await fetch(`http://127.0.0.1:${port}/shared/years.js`);

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('javascript');
  const settings = await import(`data:text/javascript;base64,${Buffer.from(await response.text()).toString('base64')}`);
  expect(settings.PROJECTION_YEARS).toContain(settings.PROJECTION_TIMEFRAME.yearStart);
  expect(settings.PROJECTION_YEARS).toContain(settings.PROJECTION_TIMEFRAME.yearEnd);
});
