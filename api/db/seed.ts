/**
 * Applies the generated seed SQL (`seed.sql` + `seed-indicators.sql`) into the
 * API's schema (default `catalog`). Pure `pg` — no psql dependency — so it runs
 * the same on a dev machine and inside the API container.
 *
 * Assumes the tables already exist (run `db:migrate` / boot `server.ts` first).
 * Usage: bun run api/db/seed.ts [schema]   (DB from DATABASE_* env)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { pgBaseConfig, DB_SCHEMA } from './connection';

const targetSchema = process.argv[2] ?? DB_SCHEMA;

const pool = new Pool({ ...pgBaseConfig(), options: `-c search_path=${targetSchema}` });
await pool.query(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`);
for (const file of ['seed.sql', 'seed-indicators.sql']) {
  const sql = readFileSync(path.join(import.meta.dir, file), 'utf-8');
  await pool.query(sql); // simple-query protocol runs the file's statements in order
}
await pool.end();
console.log(`Seeded schema "${targetSchema}".`);
