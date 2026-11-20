import { describe, expect, spyOn, test } from 'bun:test';
import { http, passthrough } from 'msw';
import { server as sourceServer } from './test-helpers';
import { apiServerOptions } from './server-options';

describe('API server', () => {
  test('returns a logged JSON timeout before a slow handler finishes', async () => {
    const log = spyOn(console, 'error').mockImplementation(() => {});
    let finish: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => { finish = resolve; });
    const timer = setTimeout(() => finish!(Response.json({ late: true })), 100);
    try {
      const options = apiServerOptions(() => pending, 0, { requestTimeoutMs: 20 });
      const response = await options.fetch(new Request('http://localhost/api/impact-geo?token=private', {
        headers: { 'cf-ray': 'test-ray', authorization: 'Basic private' },
      }));
      expect(response.status).toBe(504);
      const body = await response.json();
      expect(body).toMatchObject({ code: 'REQUEST_TIMEOUT', timeoutMs: 20 });
      expect(typeof body.requestId).toBe('string');
      expect(response.headers.get('x-request-id')).toBe(body.requestId);
      const event = JSON.parse(log.mock.calls[0][0]);
      expect(event).toMatchObject({ code: 'REQUEST_TIMEOUT', requestId: body.requestId, path: '/api/impact-geo', cfRay: 'test-ray' });
      expect(JSON.stringify(log.mock.calls)).not.toContain('private');
    } finally {
      clearTimeout(timer);
      finish!(Response.json({ late: true }));
      log.mockRestore();
    }
  });

  test('keeps streaming a response after its header deadline has passed', async () => {
    let streamController: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(controller) { streamController = controller; } });
    const options = apiServerOptions(async () => new Response(body, { headers: { 'content-type': 'image/tiff' } }), 0, { requestTimeoutMs: 20 });
    const response = await options.fetch(new Request('http://localhost/api/impact-geo'));
    await Bun.sleep(40);
    streamController!.enqueue(new Uint8Array([1, 2]));
    streamController!.close();
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
  });

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
