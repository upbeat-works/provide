import { test, expect } from 'bun:test';

const middlewares = require('../config/middlewares.js');

const envWith = (vars) => {
  const fn = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.int = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.bool = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.array = (key, fallback) => (key in vars ? vars[key] : fallback);
  return fn;
};

// Tolerate both the old array export and the new ({ env }) => array factory,
// so the RED run exercises the real current module and fails on an assertion
// (a missing host) rather than a TypeError.
const resolve = (env) =>
  typeof middlewares === 'function' ? middlewares({ env }) : middlewares;
const directivesFor = (env) =>
  resolve(env).find((m) => m && m.name === 'strapi::security')
    .config.contentSecurityPolicy.directives;

test('always allows Cloudinary for existing assets', () => {
  const d = directivesFor(envWith({}));
  expect(d['img-src']).toContain('res.cloudinary.com');
  expect(d['media-src']).toContain('res.cloudinary.com');
});

test('allows the media host when S3_PUBLIC_URL is set', () => {
  const d = directivesFor(envWith({ S3_PUBLIC_URL: 'https://cdn.example.com/media' }));
  expect(d['img-src']).toContain('cdn.example.com');
  expect(d['media-src']).toContain('cdn.example.com');
});

test('adds no media host when S3_PUBLIC_URL is unset', () => {
  const d = directivesFor(envWith({}));
  expect(d['img-src']).not.toContain('cdn.example.com');
});

test('ignores the legacy R2_PUBLIC_URL name', () => {
  const d = directivesFor(envWith({ R2_PUBLIC_URL: 'https://cdn.example.com' }));
  expect(d['img-src']).not.toContain('cdn.example.com');
});
