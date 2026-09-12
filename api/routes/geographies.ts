import { Hono } from 'hono';
import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import type { Env } from '../types';
import { schema } from '../db';

const geographies = new Hono<Env>();

geographies.get('/', async (c) => {
  const type = c.req.query('type');
  const query = c.env.DB.select().from(schema.geographies);
  const rows = type ? await query.where(eq(schema.geographies.geographyType, type)) : await query;
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

async function withParents<T extends { id: string }>(c: Context<Env>, rows: T[]): Promise<Array<T & { parents: string[] }>> {
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
