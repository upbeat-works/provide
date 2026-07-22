/**
 * Applies the Postgres migrations into the API's schema (default `catalog`),
 * idempotently. Creates the schema if missing; Drizzle tracks applied
 * migrations in its own `drizzle` schema, so re-running is a no-op.
 *
 * Usage: DATABASE_URL=postgres://… bun run api/db/migrate.ts [schema]
 */
import path from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/provide';
const targetSchema = process.argv[2] ?? process.env.DB_SCHEMA ?? 'catalog';

const pool = new Pool({ connectionString: DATABASE_URL, options: `-c search_path=${targetSchema}` });
await pool.query(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`);
await migrate(drizzle(pool), { migrationsFolder: path.join(import.meta.dir, 'migrations') });
await pool.end();
console.log(`Migrations applied to schema "${targetSchema}".`);
