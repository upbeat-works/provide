// @vitest-environment node
import { EventEmitter } from 'node:events';
import { expect, test } from 'vitest';
import { handle, handleFetch } from './hooks.server.js';

function createEvent() {
  const socket = new EventEmitter();
  return { request: new Request('http://web.test'), platform: { req: { socket } } };
}

test('cancels an outgoing request when the incoming connection closes', async () => {
  const event = createEvent();
  const response = await handle({
    event,
    resolve: async (event) => {
      const upstreamRequest = new Request('http://api.test');
      return handleFetch({
        event,
        request: upstreamRequest,
        fetch: async (request) => {
          event.platform.req.socket.emit('close');
          return new Response(null, { status: request.signal.aborted ? 499 : 200 });
        },
      });
    },
  });
  expect(response.status).toBe(499);
});

test('cleans up the connection listener once the response body finishes', async () => {
  const event = createEvent();
  const response = await handle({ event, resolve: () => new Response('data') });
  expect(event.platform.req.socket.listenerCount('close')).toBe(1);
  expect(await response.text()).toBe('data');
  expect(event.platform.req.socket.listenerCount('close')).toBe(0);
});
