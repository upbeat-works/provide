import { test, expect } from 'bun:test';

// The Strapi config module is CommonJS: ({ env }) => ({...}).
// NOTE: this test lives in cms/tests/ (NOT cms/config/) because Strapi
// auto-loads every .js file under config/ as a config file at boot.
const plugins = require('../config/plugins.js');

// Minimal stand-in for Strapi's `env` helper (only the .get form is used here).
const envWith = (vars) => {
  const fn = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.int = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.bool = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.array = (key, fallback) => (key in vars ? vars[key] : fallback);
  return fn;
};

test('falls back to the local upload provider when R2_BUCKET is unset', () => {
  const cfg = plugins({ env: envWith({}) });
  expect(cfg.upload.config.provider).toBe('local');
});

test('uses the aws-s3 provider pointed at R2 when R2_BUCKET is set', () => {
  const cfg = plugins({
    env: envWith({
      R2_BUCKET: 'media',
      R2_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
      R2_ACCESS_KEY_ID: 'k',
      R2_SECRET_ACCESS_KEY: 's',
      R2_PUBLIC_URL: 'https://cdn.example.com',
    }),
  });
  const opts = cfg.upload.config.providerOptions;
  expect(cfg.upload.config.provider).toBe('aws-s3');
  expect(opts.baseUrl).toBe('https://cdn.example.com');
  expect(opts.s3Options.endpoint).toBe('https://acc.r2.cloudflarestorage.com');
  expect(opts.s3Options.region).toBe('auto');
  expect(opts.s3Options.params.Bucket).toBe('media');
  expect(opts.s3Options.credentials.accessKeyId).toBe('k');
});

test('preserves the users-permissions jwtSecret wiring', () => {
  const cfg = plugins({ env: envWith({ JWT_SECRET: 'shhh' }) });
  expect(cfg['users-permissions'].config.jwtSecret).toBe('shhh');
});
