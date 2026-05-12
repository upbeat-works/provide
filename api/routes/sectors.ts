import { Hono } from 'hono';
import type { Env } from '../types';
import { sectors as curated } from '../curation/sectors';

const route = new Hono<Env>();

route.get('/', (c) => c.json({ sectors: curated }));

export { route as sectors };
