import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { meta } from './routes/meta';
import { geographies } from './routes/geographies';
import { impactTime } from './routes/impact-time';
import { unavoidableRisk } from './routes/unavoidable-risk';

const api = new Hono<Env>().basePath('/api');

api.use('*', cors());

api.route('/meta', meta);
api.route('/geographies', geographies);
api.route('/impact-time', impactTime);
api.route('/unavoidable-risk', unavoidableRisk);

api.get('/', (c) => {
  return c.json({ name: 'PROVIDE API', version: '0.1.0' });
});

export { api };
export type { Env };
