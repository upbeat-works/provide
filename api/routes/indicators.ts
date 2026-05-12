import { Hono } from 'hono';
import type { Env } from '../types';
import { instances } from '../instances';
import { fetchVariables } from '../ixmp4';

const indicators = new Hono<Env>();

indicators.get('/', async (c) => {
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
  const search = c.req.query('q');

  const results = await Promise.all(
    instances.map(async (instance) => {
      const variables = await fetchVariables(instance.url, instance.managerUrl, username, password, search);
      return variables.map((v) => ({
        id: v.name,
        instance: instance.slug,
      }));
    })
  );

  return c.json({ indicators: results.flat() });
});

export { indicators };
