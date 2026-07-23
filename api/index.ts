import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { catalog } from './routes/catalog';
import { geographies } from './routes/geographies';
import { indicators } from './routes/indicators';
import { impactTime } from './routes/impact-time';
import { unavoidableRisk } from './routes/unavoidable-risk';
import { studyLocations } from './routes/study-locations';
import { likelihoods } from './routes/likelihoods';
import { scenarios } from './routes/scenarios';
import { tags } from './routes/tags';

// strict: false makes /foo and /foo/ both match the same handler. The legacy
// Climate Analytics API used trailing slashes (e.g. `/api/meta/`), so we keep
// that compatible without forcing the frontend to drop them.
const api = new Hono<Env>({ strict: false }).basePath('/api');

api.use('*', cors());

api.route('/catalog', catalog);
api.route('/geographies', geographies);
api.route('/indicators', indicators);
api.route('/impact-time', impactTime);
api.route('/unavoidable-risk', unavoidableRisk);
api.route('/study-locations', studyLocations);
api.route('/likelihoods', likelihoods);
api.route('/scenarios', scenarios);
api.route('/tags', tags);

api.get('/', (c) => {
  return c.json({ name: 'PROVIDE API', version: '0.1.0' });
});

export { api };
export type { Env };
