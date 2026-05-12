import { Hono } from 'hono';
import type { Env } from '../types';
import { studyLocations } from '../curation/study-locations';

const route = new Hono<Env>();

route.get('/', (c) => c.json({ studyLocations }));

export { route as studyLocations };
