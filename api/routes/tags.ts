import { Hono } from 'hono';
import type { MetaIndicatorFilter } from '@iiasa/ixmp4-ts';
import type { Env } from '../types';
import { createPlatforms } from '../platform';

const TAG_KEYS = [
  'Sector',
  'Project',
  'Data source',
  'Spatial resolution',
  'Temporal resolution',
] as const;

const route = new Hono<Env>();

route.get('/', async (c) => {
  const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;

  // Active filters: ?Sector=Energy,Health&Project=PROVIDE -> {Sector: [...], ...}
  const activeFilters: Record<string, string[]> = {};
  for (const key of TAG_KEYS) {
    const val = c.req.query(key);
    if (val) activeFilters[key] = val.split(',');
  }

  const platforms = await createPlatforms(username, password);

  // Resolve the set of run IDs matching every active filter except `forKey`
  // (so the tag being tabulated isn't scoped by its own selection).
  async function resolveScopedRunIds(forKey: string): Promise<number[] | null> {
    const otherFilters = Object.entries(activeFilters).filter(([k]) => k !== forKey);
    if (otherFilters.length === 0) return null;

    let scopedIds: number[] | null = null;
    for (const [k, vs] of otherFilters) {
      const filter: MetaIndicatorFilter = { key: k, valueStr_in: vs };
      if (scopedIds !== null) filter.runId_in = scopedIds;

      const allIds: number[] = [];
      for (const { platform } of platforms) {
        const df = await platform.meta.tabulate(filter);
        allIds.push(...(df.columnValues('run__id') as number[]));
      }
      scopedIds = [...new Set(allIds)];
    }
    return scopedIds;
  }

  const result: Record<string, Array<{ value: string; count: number }>> = {};

  for (const tagKey of TAG_KEYS) {
    const scopedIds = await resolveScopedRunIds(tagKey);
    const counts: Record<string, number> = {};
    const filter: MetaIndicatorFilter = { key: tagKey };
    if (scopedIds !== null) filter.runId_in = scopedIds;

    for (const { platform } of platforms) {
      const df = await platform.meta.tabulate(filter);
      const values = df.columnValues('value') as string[];
      for (const value of values) {
        counts[value] = (counts[value] || 0) + 1;
      }
    }

    result[tagKey] = Object.entries(counts).map(([value, count]) => ({ value, count }));
  }

  return c.json(result);
});

export { route as tags };
