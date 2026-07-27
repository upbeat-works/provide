'use strict';
/**
 * Create the CMS's Postgres schema if it doesn't exist yet.
 *
 * Strapi's knex config (config/database.js) only sets `schema` as the
 * connection's search_path — it never creates it, so on a fresh database the
 * first migration fails with:
 *
 *   create table "strapi"."strapi_migrations" ... - schema "strapi" does not exist
 *
 * The API does the same thing for its own schema on boot (server.ts). This runs
 * as a `pre` hook of `develop`/`start`, so both the Docker container and a host
 * `yarn develop` get it for free.
 *
 * Idempotent, and safe on a locked-down production role: an existing schema is
 * detected with a plain SELECT, so CREATE is only attempted when it's genuinely
 * missing (where failing loudly is better than Strapi's opaque migration error).
 */
const { Client } = require('pg');

// Empty string (an undeclared Docker ENV) counts as unset — mirrors config/database.js.
const val = (key, def) => {
  const v = process.env[key];
  return v === undefined || v === '' ? def : v;
};
const bool = (key, def) => {
  const v = val(key, undefined);
  return v === undefined ? def : v === 'true';
};

async function main() {
  if (val('DATABASE_CLIENT', 'postgres') !== 'postgres') return; // sqlite has no schemas

  const schema = val('DATABASE_SCHEMA', 'strapi');
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(schema)) {
    throw new Error(`DATABASE_SCHEMA is not a plain identifier: ${schema}`);
  }

  const client = new Client({
    host: val('DATABASE_HOST', 'localhost'),
    port: Number(val('DATABASE_PORT', 5432)),
    database: val('DATABASE_NAME', 'provide'),
    user: val('DATABASE_USERNAME', 'postgres'),
    password: val('DATABASE_PASSWORD', 'postgres'),
    ssl: bool('DATABASE_SSL', false)
      ? { rejectUnauthorized: bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true) }
      : false,
  });

  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [
      schema,
    ]);
    if (rowCount > 0) return;

    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    console.log(`[ensure-schema] created schema "${schema}"`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`[ensure-schema] ${err.message}`);
  process.exit(1);
});
