import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { Env } from '../types';
import { createDb, schema } from '../db';

const geographies = new Hono<Env>();

geographies.get('/', async (c) => {
  const db = createDb(c.env.DB);
  const type = c.req.query('type');

  const rows = type
    ? await db.select().from(schema.geographies).where(eq(schema.geographies.geographyType, type))
    : await db.select().from(schema.geographies);

  return c.json(rows);
});

geographies.get('/types', async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db.select().from(schema.geographyTypes).orderBy(schema.geographyTypes.order);
  return c.json(rows);
});

geographies.get('/:id', async (c) => {
  const db = createDb(c.env.DB);
  const row = await db.select().from(schema.geographies).where(eq(schema.geographies.id, c.req.param('id')));
  if (!row.length) return c.json({ error: 'Not found' }, 404);
  return c.json(row[0]);
});

export { geographies };
