import { test, expect } from 'bun:test';

// Strapi config modules are CommonJS: ({ env }) => ({...}). Tests live in
// cms/tests/ (not cms/config/) so Strapi does not auto-load them at boot.
const database = require('../config/database.js');

// Minimal stand-in for Strapi's `env` helper.
const envWith = (vars) => {
  const fn = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.int = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.bool = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.array = (key, fallback) => (key in vars ? vars[key] : fallback);
  return fn;
};

test('uses the sqlite client', () => {
  const cfg = database({ env: envWith({}) });
  expect(cfg.connection.client).toBe('sqlite');
});

test('defaults the sqlite file to database/data.db when DATABASE_FILENAME is unset', () => {
  const cfg = database({ env: envWith({}) });
  expect(cfg.connection.connection.filename).toBe('database/data.db');
});

test('honors DATABASE_FILENAME (the Fly volume path in production)', () => {
  const cfg = database({ env: envWith({ DATABASE_FILENAME: '/data/data.db' }) });
  expect(cfg.connection.connection.filename).toBe('/data/data.db');
});

test('sets useNullAsDefault (knex requires it for sqlite)', () => {
  const cfg = database({ env: envWith({}) });
  expect(cfg.connection.useNullAsDefault).toBe(true);
});
