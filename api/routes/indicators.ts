import { Hono } from 'hono';
import type { VariableFilter } from '@iiasa/ixmp4-ts';
import type { Env } from '../types';
import { createPlatforms } from '../platform';
import { parseVariable } from '../conventions';
import { distinct } from '../util';

const route = new Hono<Env>();

route.get('/', async (c) => {
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
  const search = c.req.query('q');
  const region = c.req.query('region');

  const platforms = await createPlatforms(username, password);
  const filter: VariableFilter = {};
  if (search) filter.name_ilike = `*${search}*`;
  if (region) filter.region = { name: region };

  const perInstance = await Promise.all(
    platforms.map(async ({ instance, platform }) => {
      const variables = await platform.iamc.variables.list(filter);
      return variables.map((v) => ({ name: v.name, instance: instance.slug }));
    }),
  );

  // Collapse the raw ixmp4 variable strings into one entry per convention
  // indicator (matching /meta), so the catalogue can intersect by uid. With a
  // ?region= filter these are the indicators that have data for that geography.
  const perIndicator = perInstance
    .flat()
    .map(({ name, instance }) => ({ uid: parseVariable(name).indicator, instance }));
  const indicators = distinct(perIndicator, (i) => i.uid).map(({ uid, instance }) => ({
    uid,
    label: uid,
    instance,
  }));

  return c.json({ indicators });
});

export { route as indicators };
