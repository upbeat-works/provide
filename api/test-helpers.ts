import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spyOn } from 'bun:test';
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

import type { Ixmp4Datapoint } from './ixmp4';
export type { Ixmp4Datapoint };

export interface Ixmp4Fixture {
  variables?: Array<{ id: number; name: string }>;
  scenarios?: Array<{ id: number; name: string }>;
  regions?: Array<{ id: number; name: string; hierarchy?: string }>;
  runs?: Array<{
    id: number;
    model: { name: string };
    scenario: { name: string };
    version: number;
    is_default: boolean;
  }>;
  runMeta?: Array<{ id: number; run__id: number; key: string; type: string; value: unknown }>;
  timeseries?: Array<{ id: number; run__id: number; parameters: Record<string, string> }>;
  datapoints?: Ixmp4Datapoint[] | ((body: Record<string, unknown>) => Ixmp4Datapoint[]);
}

const PATH_MAP: Record<string, Exclude<keyof Ixmp4Fixture, 'datapoints'>> = {
  '/iamc/variables/': 'variables',
  '/iamc/timeseries/': 'timeseries',
  '/scenarios/': 'scenarios',
  '/regions/': 'regions',
  '/runs/': 'runs',
  '/meta/': 'runMeta',
};

export function mockIxmp4Fetch(fixture: Ixmp4Fixture) {
  return spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const req = new Request(input as RequestInfo, init);
    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname.endsWith('/token/obtain/')) {
      return new Response(JSON.stringify({ access: 'fake-token' }), { status: 200 });
    }

    if (req.method === 'PATCH') {
      if (url.pathname.endsWith('/iamc/datapoints/')) {
        const body = (await req.json()) as Record<string, unknown>;
        const rows = typeof fixture.datapoints === 'function'
          ? fixture.datapoints(body)
          : fixture.datapoints ?? [];
        return new Response(JSON.stringify({ results: rows, total: rows.length }), { status: 200 });
      }
      for (const [suffix, key] of Object.entries(PATH_MAP)) {
        if (url.pathname.endsWith(suffix)) {
          const rows = fixture[key] ?? [];
          return new Response(JSON.stringify({ results: rows, total: rows.length }), { status: 200 });
        }
      }
    }

    throw new Error(`Unexpected fetch: ${req.method} ${req.url}`);
  });
}
