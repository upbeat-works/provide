import { test, expect } from 'bun:test';
const path = require('node:path');
const database = require('../config/database.js');

function envWith(vars) {
  const env = (key, fallback) => vars[key] ?? fallback;
  env.int = (key, fallback) => Number(env(key, fallback));
  env.bool = (key, fallback) => env(key, fallback);
  return env;
}

test('connects to the CMS schema in the shared PostgreSQL database', () => {
  const { connection } = database({ env: envWith({ DATABASE_HOST: 'db', DATABASE_USERNAME: 'cms', DATABASE_PASSWORD: 'secret' }) });
  expect(connection.client).toBe('postgres');
  expect(connection.connection).toMatchObject({ host: 'db', user: 'cms', password: 'secret', schema: 'strapi' });
});

test('uses the requested SQLite file for isolated tests and exports', () => {
  const { connection } = database({ env: envWith({ DATABASE_CLIENT: 'sqlite', DATABASE_FILENAME: '/tmp/cms-test.db' }) });
  expect(connection.connection.filename).toBe('/tmp/cms-test.db');
  expect(connection.useNullAsDefault).toBe(true);
});

test('resolves the default SQLite file inside the CMS', () => {
  const { connection } = database({ env: envWith({ DATABASE_CLIENT: 'sqlite' }) });
  expect(connection.connection.filename).toBe(path.resolve(import.meta.dir, '../database/data.db'));
});
