import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(import.meta.dir, 'migrations');

/**
 * The generated migrations as an ordered list of individual DDL statements.
 * The SQL is schema-agnostic (see strip-schema-qualifiers.ts), so replaying it
 * under a given `search_path` creates the tables in that schema — used to
 * stand up an ephemeral `test_*` schema per test env.
 */
export function migrationStatements(): string[] {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const statements: string[] = [];
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    for (const stmt of sql.split('--> statement-breakpoint')) {
      const trimmed = stmt.trim();
      if (trimmed) statements.push(trimmed);
    }
  }
  return statements;
}
