import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { meta } from './routes/meta';
import { geographies } from './routes/geographies';
import { indicators } from './routes/indicators';
import { impactTime } from './routes/impact-time';
import { unavoidableRisk } from './routes/unavoidable-risk';
import { studyLocations } from './routes/study-locations';
import { likelihoods } from './routes/likelihoods';
import { indicatorParameters } from './routes/indicator-parameters';
import { scenarios } from './routes/scenarios';
import { sectors } from './routes/sectors';
import { geographyTypes } from './routes/geography-types';
import { tags } from './routes/tags';

// strict: false makes /foo and /foo/ both match the same handler. The legacy
// Climate Analytics API used trailing slashes (e.g. `/api/meta/`), so we keep
// that compatible without forcing the frontend to drop them.
const api = new Hono<Env>({ strict: false }).basePath('/api');

api.use('*', cors());

api.route('/meta', meta);
api.route('/geographies', geographies);
api.route('/indicators', indicators);
api.route('/impact-time', impactTime);
api.route('/unavoidable-risk', unavoidableRisk);
api.route('/study-locations', studyLocations);
api.route('/likelihoods', likelihoods);
api.route('/indicator-parameters', indicatorParameters);
api.route('/scenarios', scenarios);
api.route('/sectors', sectors);
api.route('/geography-types', geographyTypes);
api.route('/tags', tags);

api.get('/', (c) => {
  return c.json({ name: 'PROVIDE API', version: '0.1.0' });
});

export { api };
export type { Env };
