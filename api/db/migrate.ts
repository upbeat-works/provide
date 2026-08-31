/**
 * Applies the Postgres migrations into the API's schema (default `catalog`),
 * idempotently. Creates the schema if missing; Drizzle tracks applied
 * migrations in its own `drizzle` schema, so re-running is a no-op.
 *
 * Usage: bun run api/db/migrate.ts [schema]   (DB from DATABASE_* env)
 */
import path from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { pgBaseConfig, DB_SCHEMA } from './connection';

const targetSchema = process.argv[2] ?? DB_SCHEMA;

const pool = new Pool({ ...pgBaseConfig(), options: `-c search_path=${targetSchema}` });
await pool.query(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`);
await migrate(drizzle(pool), { migrationsFolder: path.join(import.meta.dir, 'migrations') });
await pool.end();
console.log(`Migrations applied to schema "${targetSchema}".`);
