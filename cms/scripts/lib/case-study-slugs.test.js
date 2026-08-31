'use strict';
// Run: node --test scripts/lib/case-study-slugs.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { planSlugBackfill } = require('./case-study-slugs');

const remote = [
  { city_uid: 'lisbon', title: 'Extreme heat in the Lisbon Metropolitan Area', locale: 'en-EU' },
  { city_uid: 'islamabad', title: 'Extreme heat in Islamabad', locale: 'en-EU' },
  { city_uid: 'adaptation', title: 'Climate risk dashboard for adaptation support', locale: 'en' },
  { city_uid: 'adaptation', title: 'Climate risk dashboard for adaptation support', locale: 'en-EU' },
];

test('matches on title + locale, ids differ between remote and local', () => {
  const local = [
    { id: 9, Title: 'Extreme heat in the Lisbon Metropolitan Area', locale: 'en-EU', Slug: null },
    { id: 12, Title: 'Climate risk dashboard for adaptation support', locale: 'en', Slug: null },
  ];
  assert.deepEqual(planSlugBackfill(remote, local), [
    { id: 9, locale: 'en-EU', slug: 'lisbon' },
    { id: 12, locale: 'en', slug: 'adaptation' },
  ]);
});

test('skips entries that already carry a slug', () => {
  const local = [{ id: 9, Title: 'Extreme heat in Islamabad', locale: 'en-EU', Slug: 'islamabad' }];
  assert.deepEqual(planSlugBackfill(remote, local), []);
});

test('re-running the plan against its own result is a no-op (idempotent)', () => {
  const local = [{ id: 9, Title: 'Extreme heat in Islamabad', locale: 'en-EU', Slug: null }];
  const [applied] = planSlugBackfill(remote, local);
  local[0].Slug = applied.slug;
  assert.deepEqual(planSlugBackfill(remote, local), []);
});

test('falls back to a title-only match when the locale differs', () => {
  const local = [{ id: 30, Title: 'Extreme heat in Islamabad', locale: 'en', Slug: null }];
  assert.deepEqual(planSlugBackfill(remote, local), [{ id: 30, locale: 'en', slug: 'islamabad' }]);
});

test('leaves unmatched local entries alone', () => {
  const local = [{ id: 40, Title: 'A case study written after the rename', locale: 'en', Slug: null }];
  assert.deepEqual(planSlugBackfill(remote, local), []);
});

test('ignores remote rows whose city_uid was never set', () => {
  const local = [{ id: 50, Title: 'Untitled draft', locale: 'en', Slug: null }];
  assert.deepEqual(planSlugBackfill([{ city_uid: null, title: 'Untitled draft', locale: 'en' }], local), []);
});

test('skips ambiguous titles that map to two different slugs', () => {
  const ambiguous = [
    { city_uid: 'one', title: 'Shared title', locale: 'en' },
    { city_uid: 'two', title: 'Shared title', locale: 'en-EU' },
  ];
  const local = [{ id: 60, Title: 'Shared title', locale: 'de', Slug: null }];
  assert.deepEqual(planSlugBackfill(ambiguous, local), []);
});
