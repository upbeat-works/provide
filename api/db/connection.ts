/**
 * Postgres connection config from the environment — shared by the API runtime
 * (server.ts), the migrate/seed scripts and the tests.
 *
 * Discrete fields (user & password as separate secrets): DATABASE_HOST,
 * DATABASE_PORT, DATABASE_NAME, DATABASE_USERNAME, DATABASE_PASSWORD. TLS via
 * DATABASE_SSL.
 */

/** Reads an env var, treating an empty string (e.g. an undeclared Docker `ENV`) as unset. */
function env(name: string): string | undefined;
function env(name: string, fallback: string): string;
function env(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

const truthy = (v: string | undefined) => /^(1|true|yes|on)$/i.test(v ?? '');

/** The schema this service's tables live in (the connection search_path). */
export const DB_SCHEMA = env('DATABASE_SCHEMA') ?? env('DB_SCHEMA') ?? 'catalog';

export interface PgBaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: false | { rejectUnauthorized: boolean };
}

/** A `pg`-compatible connection config from the discrete DATABASE_* env fields. */
export function pgBaseConfig(): PgBaseConfig {
  return {
    host: env('DATABASE_HOST', 'localhost'),
    port: Number(env('DATABASE_PORT', '5432')),
    database: env('DATABASE_NAME', 'provide'),
    user: env('DATABASE_USERNAME') ?? env('DATABASE_USER', 'postgres'),
    password: env('DATABASE_PASSWORD', ''),
    ssl: truthy(env('DATABASE_SSL'))
      ? { rejectUnauthorized: truthy(env('DATABASE_SSL_REJECT_UNAUTHORIZED', 'true')) }
      : false,
  };
}
