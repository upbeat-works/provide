import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { schema } from './db';
import type { Env } from './types';

const MIGRATIONS_DIR = path.join(import.meta.dir, 'db/migrations');

function applyMigrations(sqlite: Database) {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    for (const stmt of sql.split('--> statement-breakpoint')) {
      const trimmed = stmt.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
  }
}

export function createTestEnv(): Env['Bindings'] {
  const sqlite = new Database(':memory:');
  applyMigrations(sqlite);
  return {
    DB: drizzle(sqlite, { schema }) as unknown as Env['Bindings']['DB'],
    IXMP4_USERNAME: 'test-user',
    IXMP4_PASSWORD: 'test-pass',
  };
}
