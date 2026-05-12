import { Hono } from 'hono';
import type { Env } from '../types';
import { schema } from '../db';
import { geographyTypes as curated } from '../curation/geography-types';

const route = new Hono<Env>();

route.get('/', async (c) => {
  const rows = await c.env.DB.select().from(schema.geographyTypes);
  const dbByUid = new Map(rows.map((r) => [r.id, r]));

  const geographyTypes = curated.map((meta) => {
    const db = dbByUid.get(meta.uid);
    return {
      ...meta,
      label: db?.label ?? meta.label,
      labelSingular: db?.labelSingular ?? meta.labelSingular,
      isAvailable: db?.isAvailable ?? meta.isAvailable,
    };
  });

  return c.json({ geographyTypes });
});

export { route as geographyTypes };
