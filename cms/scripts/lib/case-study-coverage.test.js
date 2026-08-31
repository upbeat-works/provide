'use strict';
// Run: node --test scripts/lib/case-study-coverage.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { buildCoverage } = require('./case-study-coverage');

const cities = [
  { uid: 'lisbon', adaptationCaseStudy: 'lisbon' },
  { uid: 'berlin', adaptationCaseStudy: 'lisbon' },
  { uid: 'tokyo', adaptationCaseStudy: 'lisbon' },
  { uid: 'oslo', adaptationCaseStudy: 'lisbon' },
  { uid: 'islamabad', adaptationCaseStudy: 'islamabad' },
  { uid: 'dhaka', adaptationCaseStudy: 'islamabad' },
  { uid: 'nassau', adaptationCaseStudy: 'nassau' },
];

test('groups cities under the case study they point at', () => {
  const out = buildCoverage(cities);
  const islamabad = out.find((c) => c.slug === 'islamabad');
  assert.deepEqual(islamabad.covers, ['dhaka', 'islamabad']);
});

test('the largest group becomes the default and enumerates nothing', () => {
  const out = buildCoverage(cities);
  const lisbon = out.find((c) => c.slug === 'lisbon');
  assert.equal(lisbon.isDefault, true);
  assert.deepEqual(lisbon.covers, []);
});

test('exactly one default', () => {
  const out = buildCoverage(cities);
  assert.equal(out.filter((c) => c.isDefault).length, 1);
});

test('the default can be named explicitly', () => {
  const out = buildCoverage(cities, { defaultSlug: 'nassau' });
  assert.equal(out.find((c) => c.slug === 'nassau').isDefault, true);
  assert.equal(out.find((c) => c.slug === 'lisbon').isDefault, false);
  assert.deepEqual(out.find((c) => c.slug === 'lisbon').covers, ['berlin', 'lisbon', 'oslo', 'tokyo']);
});

test('every non-default city is covered exactly once', () => {
  const out = buildCoverage(cities);
  const covered = out.flatMap((c) => c.covers);
  assert.equal(new Set(covered).size, covered.length);
  assert.deepEqual(covered.sort(), ['dhaka', 'islamabad', 'nassau']);
});

test('collapses 144 cities into far fewer entries than one per city', () => {
  const out = buildCoverage(cities);
  assert.ok(out.length < cities.length);
  assert.deepEqual(
    out.map((c) => c.slug),
    ['islamabad', 'lisbon', 'nassau']
  );
});

test('skips cities with no target and cities with no uid', () => {
  const out = buildCoverage([...cities, { uid: 'nowhere' }, { adaptationCaseStudy: 'lisbon' }]);
  assert.ok(!out.flatMap((c) => c.covers).includes('nowhere'));
  assert.ok(!out.flatMap((c) => c.covers).includes(undefined));
});

test('tolerates empty / missing input', () => {
  assert.deepEqual(buildCoverage([]), []);
  assert.deepEqual(buildCoverage(undefined), []);
});
