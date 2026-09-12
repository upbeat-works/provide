import { describe, expect, test } from 'bun:test';
import { http, passthrough } from 'msw';
import { server as sourceServer } from './test-helpers';
import { apiServerOptions } from './server-options';

describe('API server', () => {
  test('keeps a slow source-backed response connected for more than 10 seconds', async () => {
    sourceServer.use(http.get(/^http:\/\/localhost:\d+\/$/, () => passthrough()));
    const server = Bun.serve(
      apiServerOptions(async () => {
        await Bun.sleep(12_000);
        return Response.json({ scenarios: [] });
      }, 0)
    );

    try {
      const response = await fetch(server.url);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ scenarios: [] });
    } finally {
      server.stop(true);
    }
  }, 20_000);
});
