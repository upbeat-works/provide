import { Hono } from 'hono';
import type { Env } from '../types';
import { likelihoods } from '../curation/likelihoods';

const route = new Hono<Env>();

route.get('/', (c) => c.json({ likelihoods }));

export { route as likelihoods };
