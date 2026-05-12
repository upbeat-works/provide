import { drizzle } from 'drizzle-orm/d1';
import { api } from './api';
import { schema } from './api/db';

export default {
  async fetch(request: Request, env: { DB: D1Database; IXMP4_USERNAME: string; IXMP4_PASSWORD: string }, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api')) {
      const wrappedEnv = {
        ...env,
        DB: drizzle(env.DB, { schema }),
      };
      return api.fetch(request, wrappedEnv, ctx);
    }

    return new Response('Not found', { status: 404 });
  },
};
