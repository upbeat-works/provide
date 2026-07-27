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

test('falls back to the local upload provider when S3_BUCKET is unset', () => {
  const cfg = plugins({ env: envWith({}) });
  expect(cfg.upload.config.provider).toBe('local');
});

test('uses the aws-s3 provider when S3_BUCKET is set', () => {
  const cfg = plugins({
    env: envWith({
      S3_BUCKET: 'media',
      S3_ENDPOINT: 'http://minio.storage.svc.cluster.local:9000',
      S3_ACCESS_KEY_ID: 'k',
      S3_SECRET_ACCESS_KEY: 's',
      S3_PUBLIC_URL: 'https://cdn.example.com/media',
      S3_REGION: 'us-east-1',
    }),
  });
  const opts = cfg.upload.config.providerOptions;
  expect(cfg.upload.config.provider).toBe('aws-s3');
  expect(opts.baseUrl).toBe('https://cdn.example.com/media');
  expect(opts.s3Options.endpoint).toBe('http://minio.storage.svc.cluster.local:9000');
  expect(opts.s3Options.region).toBe('us-east-1');
  expect(opts.s3Options.params.Bucket).toBe('media');
  expect(opts.s3Options.credentials.accessKeyId).toBe('k');
});

// Self-hosted S3 gateways (MinIO, Ceph) can't do virtual-host addressing;
// R2 accepts path-style too, so this is safe to pin on rather than expose.
test('always addresses the bucket path-style', () => {
  const cfg = plugins({ env: envWith({ S3_BUCKET: 'media' }) });
  expect(cfg.upload.config.providerOptions.s3Options.forcePathStyle).toBe(true);
});

test('defaults the region to auto when S3_REGION is unset', () => {
  const cfg = plugins({ env: envWith({ S3_BUCKET: 'media' }) });
  expect(cfg.upload.config.providerOptions.s3Options.region).toBe('auto');
});

test('ignores the legacy R2_* names', () => {
  const cfg = plugins({ env: envWith({ R2_BUCKET: 'media' }) });
  expect(cfg.upload.config.provider).toBe('local');
});

test('preserves the users-permissions jwtSecret wiring', () => {
  const cfg = plugins({ env: envWith({ JWT_SECRET: 'shhh' }) });
  expect(cfg['users-permissions'].config.jwtSecret).toBe('shhh');
});
