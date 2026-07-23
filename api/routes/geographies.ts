import { Hono } from 'hono';
import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import type { Env } from '../types';
import { schema } from '../db';
import { createPlatforms } from '../platform';
import { representativeVariable } from '../conventions';

const geographies = new Hono<Env>();

geographies.get('/', async (c) => {
  const type = c.req.query('type');
  const indicator = c.req.query('indicator');

  let allowedRegions: Set<string> | null = null;
  if (indicator) {
    const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
    const platforms = await createPlatforms(username, password);
    allowedRegions = new Set<string>();
    for (const { platform } of platforms) {
      // The indicator id is collapsed (e.g. "Mean Temperature"); resolve it to a
      // full faceted variable name so it matches actual ixmp4 variables.
      const regions = await platform.regions.list({
        iamc: { variable: { name: representativeVariable(indicator) } },
      });
      for (const r of regions) allowedRegions.add(r.name);
    }
    if (allowedRegions.size === 0) return c.json([]);
  }

  // Only the (single-param) type filter goes to SQL. The region intersection is
  // done in JS: there can be >100 matching regions, which would blow past D1's
  // bound-parameter limit if expressed as `id IN (...)`.
  const query = c.env.DB.select().from(schema.geographies);
  const all = type ? await query.where(eq(schema.geographies.geographyType, type)) : await query;
  const rows = allowedRegions ? all.filter((g) => allowedRegions!.has(g.id)) : all;
  return c.json(await withParents(c, rows));
});

geographies.get('/types', async (c) => {
  const rows = await c.env.DB.select().from(schema.geographyTypes).orderBy(schema.geographyTypes.order);
  return c.json(rows);
});

geographies.get('/:id', async (c) => {
  const row = await c.env.DB.select()
    .from(schema.geographies)
    .where(eq(schema.geographies.id, c.req.param('id')));
  if (!row.length) return c.json({ error: 'Not found' }, 404);
  const [withP] = await withParents(c, row);
  return c.json(withP);
});

async function withParents<T extends { id: string }>(
  c: Context<Env>,
  rows: T[],
): Promise<Array<T & { parents: string[] }>> {
  if (!rows.length) return [];
  // Fetch the whole (small) parents table and group in JS rather than
  // `geographyId IN (...rows)`, which can exceed D1's bound-parameter limit when
  // many geographies match.
  const ids = new Set(rows.map((r) => r.id));
  const parentRows = await c.env.DB.select().from(schema.geographyParents);
  const byChild: Record<string, string[]> = {};
  for (const p of parentRows) {
    if (ids.has(p.geographyId)) (byChild[p.geographyId] ??= []).push(p.parentId);
  }
  return rows.map((r) => ({ ...r, parents: byChild[r.id] ?? [] }));
}

export { geographies };
