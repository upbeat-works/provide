import { Hono } from 'hono';
import path from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { api } from './api/index.ts';
import { schema } from './api/db/index.ts';
import { pgBaseConfig, DB_SCHEMA } from './api/db/connection.ts';

// One shared pool; every connection pins the search_path to the API's schema so
// the unqualified tables resolve to (and migrations land in) `catalog`.
const pool = new Pool({ ...pgBaseConfig(), options: `-c search_path=${DB_SCHEMA}` });
await pool.query(`CREATE SCHEMA IF NOT EXISTS "${DB_SCHEMA}"`);

const db = drizzle(pool, { schema });

// Apply pending migrations at boot (idempotent — Drizzle tracks them).
await migrate(db, { migrationsFolder: path.join(import.meta.dir, 'api/db/migrations') });

const app = new Hono({ strict: false });

app.use('*', async (c, next) => {
  c.env = {
    DB: db,
    IXMP4_USERNAME: process.env.IXMP4_USERNAME ?? '',
    IXMP4_PASSWORD: process.env.IXMP4_PASSWORD ?? '',
  };
  await next();
});

app.route('/', api);

const port = Number(process.env.PORT ?? 8080);
console.log(`PROVIDE API listening on http://0.0.0.0:${port}`);

export default { fetch: app.fetch, port };
