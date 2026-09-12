type ApiFetch = (request: Request) => Response | Promise<Response>;

export function apiServerOptions(fetch: ApiFetch, port: number) {
  return {
    fetch,
    port,
    idleTimeout: 60,
  };
}
