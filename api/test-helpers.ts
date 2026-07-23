import { Pool, Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { schema } from './db';
import { migrationStatements } from './db/migrations-sql';
import { pgBaseConfig } from './db/connection';
import { instances } from './instances';
import type { Env } from './types';

// The generated DDL, replayed into each test's ephemeral schema.
const MIGRATION_SQL = migrationStatements();

// A single admin connection used only to CREATE/DROP the per-test schemas.
let adminPool: Pool | null = null;
function admin(): Pool {
  if (!adminPool) adminPool = new Pool(pgBaseConfig());
  return adminPool;
}

interface ActiveEnv {
  schema: string;
  client: Client;
}
// Every env created since the last teardown, so a global afterEach can drop
// their schemas and close their connections without each test tracking them.
const active: ActiveEnv[] = [];

function uniqueSchemaName(): string {
  return `test_${crypto.randomUUID().replace(/-/g, '')}`;
}

/**
 * Stands up an isolated database for one test: a fresh `test_*` schema on the
 * local Postgres, with the migrations replayed into it and the connection's
 * search_path pinned to it. Fully isolated per call (mirrors the old in-memory
 * SQLite). The schema + connection are torn down by `teardownTestEnvs()`.
 */
export async function createTestEnv(): Promise<Env['Bindings']> {
  const name = uniqueSchemaName();
  await admin().query(`CREATE SCHEMA "${name}"`);
  const client = new Client({ ...pgBaseConfig(), options: `-c search_path=${name}` });
  await client.connect();
  for (const stmt of MIGRATION_SQL) await client.query(stmt);
  active.push({ schema: name, client });
  return {
    DB: drizzle(client, { schema }),
    IXMP4_USERNAME: 'test-user',
    IXMP4_PASSWORD: 'test-pass',
  };
}

/** Drop every schema + close every connection created since the last call. */
export async function teardownTestEnvs(): Promise<void> {
  const envs = active.splice(0);
  for (const { schema: name, client } of envs) {
    await client.end().catch(() => {});
    await admin().query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
  }
}

/** Sweep any `test_*` schemas leaked by a previously crashed run. */
export async function dropStaleTestSchemas(): Promise<void> {
  const { rows } = await admin().query<{ schema_name: string }>(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'test\\_%'",
  );
  for (const { schema_name } of rows) {
    await admin().query(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE`);
  }
}

/** Final cleanup: tear down active envs and close the admin pool. */
export async function closeTestDb(): Promise<void> {
  await teardownTestEnvs();
  if (adminPool) {
    await adminPool.end();
    adminPool = null;
  }
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
