'use strict';
// Run: node --test scripts/lib/scenario-uid-map.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { IXMP4_UID_BY_LEGACY, ixmp4UidFor, planScenarioRekey } = require('./scenario-uid-map');

// The 11 scenario names GET /api/catalog returns from `provide-internal` today
// (2026-07-27). `Today` is the convention baseline and has no CMS entry.
const LIVE = [
  'SSP5-3.4-OS',
  'Stabilisation At 1.5°C',
  '2020 Climate Policies',
  '2020 Climate Targets',
  'Delayed Climate Action',
  'High Negative Emissions',
  'High Renewables',
  'Low Demand',
  'SSP1-1.9',
  'Shifting Pathway',
  'Today',
];

// The overshoot / stabilisation / net-zero / extended variants. They exist in the
// CMS and in the legacy API but NOT in ixmp4 today, so they must stay legacy.
const UNMAPPED = [
  'curpol-os',
  'curpol-sap',
  'gs-nzghg',
  'ld-nzghg',
  'modact-os-1.5c',
  'modact-os-1c',
  'modact-sap',
  'neg-nzghg',
  'neg-os-0',
  'neg-sap',
  'ref-1p5-extended',
  'ren-nzco2',
  'sp-nzghg',
  'ssp119-extended',
  'ssp534-over-extended',
];

test('maps exactly the 10 legacy uids that ixmp4 serves today', () => {
  assert.equal(Object.keys(IXMP4_UID_BY_LEGACY).length, 10);
});

test('every target name is one ixmp4 actually returns', () => {
  for (const name of Object.values(IXMP4_UID_BY_LEGACY)) {
    assert.ok(LIVE.includes(name), `${name} is not a live ixmp4 scenario`);
  }
});

test('targets are unique — no two legacy uids collapse onto one scenario', () => {
  const targets = Object.values(IXMP4_UID_BY_LEGACY);
  assert.equal(new Set(targets).size, targets.length);
});

test('resolves the documented pairs', () => {
  assert.equal(ixmp4UidFor('curpol'), '2020 Climate Policies');
  assert.equal(ixmp4UidFor('gs'), 'Delayed Climate Action');
  assert.equal(ixmp4UidFor('sp'), 'Shifting Pathway');
  assert.equal(ixmp4UidFor('modact'), '2020 Climate Targets');
  assert.equal(ixmp4UidFor('neg'), 'High Negative Emissions');
  assert.equal(ixmp4UidFor('ren'), 'High Renewables');
  assert.equal(ixmp4UidFor('ld'), 'Low Demand');
  assert.equal(ixmp4UidFor('ssp119'), 'SSP1-1.9');
  assert.equal(ixmp4UidFor('ssp534-over'), 'SSP5-3.4-OS');
  assert.equal(ixmp4UidFor('ref-1p5'), 'Stabilisation At 1.5°C');
});

test('leaves the variants ixmp4 does not serve alone', () => {
  for (const uid of UNMAPPED) assert.equal(ixmp4UidFor(uid), null, `${uid} should not map`);
});

test('is case-insensitive on the legacy uid', () => {
  assert.equal(ixmp4UidFor('CurPol'), '2020 Climate Policies');
  assert.equal(ixmp4UidFor('SSP534-Over'), 'SSP5-3.4-OS');
});

test('returns null for unknown / empty input', () => {
  assert.equal(ixmp4UidFor('nope'), null);
  assert.equal(ixmp4UidFor(''), null);
  assert.equal(ixmp4UidFor(undefined), null);
});

test('plans one update per row that needs one, across locales', () => {
  const plan = planScenarioRekey([
    { id: 36, locale: 'en', UID: 'curpol' },
    { id: 48, locale: 'en-EU', UID: 'curpol' },
    { id: 43, locale: 'en', UID: 'gs' },
  ]);
  assert.deepEqual(plan, [
    { id: 36, locale: 'en', from: 'curpol', to: '2020 Climate Policies' },
    { id: 48, locale: 'en-EU', from: 'curpol', to: '2020 Climate Policies' },
    { id: 43, locale: 'en', from: 'gs', to: 'Delayed Climate Action' },
  ]);
});

test('skips rows with no live counterpart', () => {
  const plan = planScenarioRekey([
    { id: 1, locale: 'en-EU', UID: 'curpol-os' },
    { id: 2, locale: 'en-EU', UID: 'neg-nzghg' },
  ]);
  assert.deepEqual(plan, []);
});

test('is idempotent — already-migrated rows produce no update', () => {
  const rows = [
    { id: 36, locale: 'en', UID: '2020 Climate Policies' },
    { id: 43, locale: 'en', UID: 'Delayed Climate Action' },
    { id: 99, locale: 'en', UID: 'Today' },
  ];
  assert.deepEqual(planScenarioRekey(rows), []);
});

test('a second pass over the result of a first pass is a no-op', () => {
  const rows = [{ id: 36, locale: 'en', UID: 'curpol' }];
  const first = planScenarioRekey(rows);
  assert.equal(first.length, 1);
  const migrated = rows.map((r) => ({ ...r, UID: first[0].to }));
  assert.deepEqual(planScenarioRekey(migrated), []);
});

test('tolerates missing / malformed rows', () => {
  assert.deepEqual(planScenarioRekey([]), []);
  assert.deepEqual(planScenarioRekey(undefined), []);
  assert.deepEqual(planScenarioRekey([{ id: 5, locale: 'en' }]), []);
});
