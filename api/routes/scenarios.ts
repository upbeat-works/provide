import { Hono } from 'hono';
import type { Env } from '../types';
import { instances } from '../instances';
import { fetchRuns } from '../ixmp4';
import { scenarios as curated, scenarioByUid } from '../curation/scenarios';

const route = new Hono<Env>();

route.get('/', async (c) => {
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;

  const runsPerInstance = await Promise.all(
    instances.map((instance) => fetchRuns(instance.url, instance.managerUrl, username, password)),
  );

  const seen = new Set<string>();
  const scenarios: typeof curated = [];
  for (const runs of runsPerInstance) {
    for (const run of runs) {
      const uid = run.scenario.name;
      if (seen.has(uid)) continue;
      const meta = scenarioByUid[uid];
      if (!meta) continue;
      seen.add(uid);
      scenarios.push(meta);
    }
  }

  return c.json({ scenarios });
});

export { route as scenarios };
