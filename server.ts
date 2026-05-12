import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { api } from './api/index.ts';
import { schema } from './api/db/index.ts';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const sqlite = new Database(process.env.DB_PATH ?? 'data.db');

const migrationsDir = path.join(import.meta.dir, 'api/db/migrations');
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(path.join(migrationsDir, file), 'utf-8');
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim();
    if (trimmed) sqlite.exec(trimmed);
  }
}

const db = drizzle(sqlite, { schema });

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
