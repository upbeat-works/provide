export async function handle({ event, resolve }) {
  const socket = event.platform?.req?.socket;
  if (!socket) return resolve(event);

  const connection = new AbortController();
  const disconnect = () => connection.abort(new DOMException('Client disconnected.', 'AbortError'));
  const cleanup = () => socket.off('close', disconnect);
  socket.once('close', disconnect);
  if (socket.destroyed) disconnect();

  try {
    event.request = new Request(event.request, {
      signal: AbortSignal.any([event.request.signal, connection.signal]),
    });
    const response = await resolve(event);
    if (!response.body) {
      cleanup();
      return response;
    }

    const reader = response.body.getReader();
    const body = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            cleanup();
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch (error) {
          cleanup();
          controller.error(error);
        }
      },
      cancel(reason) {
        cleanup();
        return reader.cancel(reason);
      },
    });
    return new Response(body, response);
  } catch (error) {
    cleanup();
    throw error;
  }
}

export function handleFetch({ event, request, fetch }) {
  const signal = AbortSignal.any([event.request.signal, request.signal]);
  return fetch(new Request(request, { signal }));
}
