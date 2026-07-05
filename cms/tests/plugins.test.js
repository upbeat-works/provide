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

test('falls back to the local upload provider when CLOUDINARY_NAME is unset', () => {
  const cfg = plugins({ env: envWith({}) });
  expect(cfg.upload.config.provider).toBe('local');
});

test('uses the cloudinary provider when CLOUDINARY_NAME is set', () => {
  const cfg = plugins({
    env: envWith({ CLOUDINARY_NAME: 'demo', CLOUDINARY_KEY: 'k', CLOUDINARY_SECRET: 's' }),
  });
  expect(cfg.upload.config.provider).toBe('cloudinary');
  expect(cfg.upload.config.providerOptions.cloud_name).toBe('demo');
});

test('preserves the users-permissions jwtSecret wiring', () => {
  const cfg = plugins({ env: envWith({ JWT_SECRET: 'shhh' }) });
  expect(cfg['users-permissions'].config.jwtSecret).toBe('shhh');
});
