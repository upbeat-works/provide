import { api } from './api';

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api')) {
      return api.fetch(request, env, ctx);
    }

    // Everything else is handled by Cloudflare's asset serving (configured in wrangler.jsonc)
    return new Response('Not found', { status: 404 });
  },
};
