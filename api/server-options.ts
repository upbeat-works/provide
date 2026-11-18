type ApiFetch = (request: Request) => Response | Promise<Response>;

export function apiServerOptions(fetch: ApiFetch, port: number, options: { requestTimeoutMs?: number } = {}) {
  const requestTimeoutMs = options.requestTimeoutMs ?? 45_000;
  return {
    async fetch(request: Request): Promise<Response> {
      const started = performance.now();
      let expired = false;
      let timer: ReturnType<typeof setTimeout>;
      const deadline = new Promise<Response>((resolve) => {
        timer = setTimeout(() => {
          expired = true;
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
        }, requestTimeoutMs);
      });
      try {
        const response = Promise.resolve().then(() => fetch(request)).then((result) => {
          if (expired) void result.body?.cancel().catch(() => {});
          return result;
        });
        return await Promise.race([response, deadline]);
      } finally {
        clearTimeout(timer!);
      }
    },
    port,
    idleTimeout: 60,
  };
}
