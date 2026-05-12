import { Hono } from 'hono';
import type { Env } from '../types';
import { instances } from '../instances';
import { fetchRuns, fetchTimeSeries, fetchVariables } from '../ixmp4';
import { indicatorByUid } from '../curation/indicators';

const route = new Hono<Env>();

route.get('/', async (c) => {
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
  const search = c.req.query('q');
  const sector = c.req.query('sector');

  const perInstance = await Promise.all(
    instances.map(async (instance) => {
      const variables = await fetchVariables(
        instance.url,
        instance.managerUrl,
        username,
        password,
        search,
      );
      return variables.map((v) => ({ name: v.name, instance: instance.slug }));
    }),
  );

  const seen = new Set<string>();
  const indicators: Array<Record<string, unknown>> = [];
  for (const list of perInstance) {
    for (const { name, instance } of list) {
      if (seen.has(name)) continue;
      const meta = indicatorByUid[name];
      // if (!meta) continue;
      if (sector && meta.sector !== sector) continue;
      seen.add(name);
      indicators.push({ ...meta, name, instance });
    }
  }

  return c.json({ indicators });
});

route.get('/:uid/timeseries', async (c) => {
  const uid = c.req.param('uid');
  if (!indicatorByUid[uid]) {
    return c.json({ error: 'Not found' }, 404);
  }
  const scenario = c.req.query('scenario');
  const region = c.req.query('region');
  if (!scenario || !region) {
    return c.json({ error: 'scenario and region query parameters are required' }, 400);
  }

  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;

  for (const instance of instances) {
    const runs = await fetchRuns(instance.url, instance.managerUrl, username, password);
    const run = runs.find((r) => r.scenario.name === scenario);
    if (!run) continue;
    const series = await fetchTimeSeries(instance.url, instance.managerUrl, username, password, {
      variable: uid,
      runId: run.id,
      region,
    });
    return c.json(series);
  }

  return c.json({ error: 'Not found' }, 404);
});

export { route as indicators };
