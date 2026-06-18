import { Hono } from 'hono';
import type { Env } from '../types';
import { schema } from '../db';

const route = new Hono<Env>();

route.get('/', async (c) => {
  const rows = await c.env.DB
    .select()
    .from(schema.geographyTypes)
    .orderBy(schema.geographyTypes.order);

  const geographyTypes = rows.map((r) => ({
    uid: r.id,
    label: r.label,
    labelSingular: r.labelSingular ?? undefined,
    order: r.order ?? undefined,
    isAvailable: r.isAvailable ?? true,
  }));

  return c.json({ geographyTypes });
});

export { route as geographyTypes };
