import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { geographies } from './routes/geographies';
import { indicators } from './routes/indicators';
import { geographyAvailability } from './routes/geography-availability';
import { indicatorDetails } from './routes/indicator-details';
import { impactTime } from './routes/impact-time';
import { unavoidableRisk } from './routes/unavoidable-risk';
import { studyLocations } from './routes/study-locations';
import { likelihoods } from './routes/likelihoods';
import { methodologyScenarios } from './routes/methodology-scenarios';
import { scenarioAvailability } from './routes/scenario-availability';
import { scenarioDetails } from './routes/scenario-details';
import { tags } from './routes/tags';
import { exploreDefaults } from './routes/explore-defaults';

// strict: false makes /foo and /foo/ both match the same handler. The legacy
// Climate Analytics API used trailing slashes (e.g. `/api/meta/`), so we keep
// that compatible without forcing the frontend to drop them.
const api = new Hono<Env>({ strict: false }).basePath('/api');

api.use('*', cors());

api.route('/geographies', geographies);
api.route('/indicators', indicators);
api.route('/geography-availability', geographyAvailability);
api.route('/indicator-details', indicatorDetails);
api.route('/impact-time', impactTime);
api.route('/unavoidable-risk', unavoidableRisk);
api.route('/study-locations', studyLocations);
api.route('/likelihoods', likelihoods);
api.route('/methodology-scenarios', methodologyScenarios);
api.route('/scenario-availability', scenarioAvailability);
api.route('/scenario-details', scenarioDetails);
api.route('/tags', tags);
api.route('/explore-defaults', exploreDefaults);

api.get('/', (c) => {
  return c.json({ name: 'PROVIDE API', version: '0.1.0' });
});

export { api };
export type { Env };
