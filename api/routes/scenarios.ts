import { Hono } from 'hono';
import type { Env } from '../types';
import { createPlatforms } from '../platform';
import { scenarios as curated, scenarioByUid } from '../curation/scenarios';

const route = new Hono<Env>();

route.get('/', async (c) => {
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
  const platforms = await createPlatforms(username, password);

  const runsPerInstance = await Promise.all(
    platforms.map(({ platform }) => platform.runs.list()),
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
