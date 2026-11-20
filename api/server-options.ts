type ApiFetch = (request: Request) => Response | Promise<Response>;

export function apiServerOptions(fetch: ApiFetch, port: number, options: { requestTimeoutMs?: number } = {}) {
  const requestTimeoutMs = options.requestTimeoutMs ?? 45_000;
  return {
    async fetch(request: Request): Promise<Response> {
      const disconnected = () => new Response(null, { status: 499, headers: { 'cache-control': 'no-store' } });
      if (request.signal.aborted) return disconnected();
      const started = performance.now();
      const controller = new AbortController();
      const signal = AbortSignal.any([request.signal, controller.signal]);
      const upstreamRequest = new Request(request, { signal });
      let timer: ReturnType<typeof setTimeout>;
      const deadline = new Promise<Response>((resolve) => {
        timer = setTimeout(() => {
          const requestId = crypto.randomUUID();
          const code = 'REQUEST_TIMEOUT';
          console.error(JSON.stringify({
            event: 'api_request_timeout', requestId, code, status: 504,
            path: new URL(request.url).pathname, method: request.method,
            cfRay: request.headers.get('cf-ray') ?? undefined,
            timeoutMs: requestTimeoutMs, elapsedMs: Math.round(performance.now() - started),
          }));
          resolve(Response.json({
            error: `The API did not finish the request within ${requestTimeoutMs / 1000} seconds. Please try again.`,
            code, requestId, timeoutMs: requestTimeoutMs,
          }, { status: 504, headers: { 'x-request-id': requestId, 'cache-control': 'no-store', 'access-control-allow-origin': '*' } }));
          controller.abort(new DOMException('The API request timed out.', 'TimeoutError'));
        }, requestTimeoutMs);
      });
      let onDisconnect: () => void;
      const cancellation = new Promise<Response>((resolve) => {
        onDisconnect = () => resolve(disconnected());
        request.signal.addEventListener('abort', onDisconnect, { once: true });
      });
      try {
        const response = Promise.resolve().then(() => signal.aborted ? disconnected() : fetch(upstreamRequest)).then((result) => {
          if (signal.aborted) void result.body?.cancel().catch(() => {});
          return result;
        });
        return await Promise.race([response, deadline, cancellation]);
      } finally {
        clearTimeout(timer!);
        request.signal.removeEventListener('abort', onDisconnect!);
      }
    },
    port,
    idleTimeout: 60,
  };
}
