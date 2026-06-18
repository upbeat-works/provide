import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { schema } from './db';
import { instances } from './instances';
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

/**
 * Wraps rows in the ixmp4 enumeration response envelope (row-oriented). Use
 * inside MSW handlers when returning fixture data for `*.list()` calls.
 */
export function listEnvelope(rows: unknown[]): {
  results: unknown[];
  total: number;
  pagination: { limit: number; offset: number };
} {
  return { results: rows, total: rows.length, pagination: { limit: 100, offset: 0 } };
}

/**
 * Wraps a tabular response for `*.tabulate()` calls. The SDK reads it as a
 * pandas-style DataFrame: columns + rows-of-values + dtypes.
 */
export function tabulateEnvelope(columns: string[], rows: unknown[][]): {
  results: { data: unknown[][]; index: number[]; columns: string[]; dtypes: string[] };
  total: number;
  pagination: { limit: number; offset: number };
} {
  return {
    results: {
      data: rows,
      index: rows.map((_, i) => i),
      columns,
      dtypes: columns.map(() => 'object'),
    },
    total: rows.length,
    pagination: { limit: 100, offset: 0 },
  };
}

/**
 * The instance that tests target. Handlers use its exact URLs so that any
 * outbound request to a different host fails the test loudly.
 */
export const testInstance = instances[0];

const enumerationPaths = [
  '/iamc/variables/',
  '/iamc/timeseries/',
  '/iamc/datapoints/',
  '/scenarios/',
  '/regions/',
  '/units/',
  '/runs/',
  '/meta/',
];

/**
 * Default MSW handlers: token endpoint returns a fake token, every ixmp4
 * enumeration endpoint returns an empty paginated envelope. Override per-test
 * with `server.use(...)`.
 */
// Empty-tabulate columns per endpoint so `df.columnValues(...)` doesn't throw
// on an unknown column when the SDK reads from a default empty response.
const tabulateColumns: Record<string, string[]> = {
  '/meta/': ['run__id', 'key', 'value'],
  '/iamc/timeseries/': ['run__id', 'variable', 'region', 'unit'],
  '/iamc/datapoints/': ['time_series__id', 'step_year', 'value'],
};

function emptyEnumerationResponse(request: Request, suffix: string): Response {
  const isTabulate = new URL(request.url).searchParams.get('table') === 'true';
  if (isTabulate) {
    return HttpResponse.json(tabulateEnvelope(tabulateColumns[suffix] ?? [], []));
  }
  return HttpResponse.json(listEnvelope([]));
}

const defaultHandlers = [
  http.post(`${testInstance.managerUrl}/token/obtain/`, () =>
    HttpResponse.json({ access: 'fake-token' }),
  ),
  ...enumerationPaths.map((p) =>
    http.patch(`${testInstance.url}${p}`, ({ request }) => emptyEnumerationResponse(request, p)),
  ),
];

export const server = setupServer(...defaultHandlers);
