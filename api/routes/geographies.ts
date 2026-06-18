import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import type { Env } from '../types';
import { schema } from '../db';
import { createPlatforms } from '../platform';

const geographies = new Hono<Env>();

geographies.get('/', async (c) => {
  const type = c.req.query('type');
  const indicator = c.req.query('indicator');

  let regionNames: string[] | null = null;
  if (indicator) {
    const { IXMP4_USERNAME: username, IXMP4_PASSWORD: password } = c.env;
    const platforms = await createPlatforms(username, password);
    const names = new Set<string>();
    for (const { platform } of platforms) {
      const regions = await platform.regions.list({
        iamc: { variable: { name: indicator } },
      });
      for (const r of regions) names.add(r.name);
    }
    if (names.size === 0) return c.json([]);
    regionNames = [...names];
  }

  const conditions = [];
  if (type) conditions.push(eq(schema.geographies.geographyType, type));
  if (regionNames !== null) conditions.push(inArray(schema.geographies.id, regionNames));

  const query = c.env.DB.select().from(schema.geographies);
  const rows = conditions.length ? await query.where(and(...conditions)) : await query;
  return c.json(rows);
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
  return c.json(row[0]);
});

export { geographies };
