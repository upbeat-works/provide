import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { Env } from '../types';
import { schema } from '../db';

const geographies = new Hono<Env>();

geographies.get('/', async (c) => {
  const type = c.req.query('type');
  const rows = type
    ? await c.env.DB.select().from(schema.geographies).where(eq(schema.geographies.geographyType, type))
    : await c.env.DB.select().from(schema.geographies);
  return c.json(rows);
});

geographies.get('/types', async (c) => {
  const rows = await c.env.DB.select().from(schema.geographyTypes).orderBy(schema.geographyTypes.order);
  return c.json(rows);
});

geographies.get('/:id', async (c) => {
  const row = await c.env.DB.select().from(schema.geographies).where(eq(schema.geographies.id, c.req.param('id')));
  if (!row.length) return c.json({ error: 'Not found' }, 404);
  return c.json(row[0]);
});

export { geographies };
