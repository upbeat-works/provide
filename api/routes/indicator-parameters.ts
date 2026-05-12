import { Hono } from 'hono';
import type { Env } from '../types';
import { indicatorParameters } from '../curation/indicator-parameters';

const route = new Hono<Env>();

route.get('/', (c) => c.json({ indicatorParameters }));

export { route as indicatorParameters };
