/**
 * Post-processes drizzle-kit's generated migrations so they are schema-agnostic.
 *
 * Why: our tables live in the `catalog` schema (and, in tests, in an ephemeral
 * `test_*` schema) — selected at connect time via `search_path`, not baked into
 * the DDL. drizzle-kit emits unqualified `CREATE TABLE` (good) but qualifies FK
 * references to the default schema (`REFERENCES "public"."geography_types"`),
 * which breaks when the tables actually live in `catalog`/`test_*`. Stripping the
 * `"public".` qualifier makes every statement resolve through `search_path`, so
 * the exact same migration set applies into any schema.
 *
 * Run automatically by `npm run db:generate` after `drizzle-kit generate`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(import.meta.dir, 'migrations');

function stripPublicQualifier(sql: string): string {
  // Remove the `"public".` schema qualifier wherever drizzle-kit inserts it
  // (FK references, and any other qualified identifier). Table names then
  // resolve through the connection's search_path.
  return sql.replace(/"public"\./g, '');
}

let changed = 0;
for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))) {
  const full = path.join(MIGRATIONS_DIR, file);
  const original = readFileSync(full, 'utf-8');
  const stripped = stripPublicQualifier(original);
  if (stripped !== original) {
    writeFileSync(full, stripped);
    changed += 1;
  }
}

console.log(`strip-schema-qualifiers: rewrote ${changed} migration file(s).`);
