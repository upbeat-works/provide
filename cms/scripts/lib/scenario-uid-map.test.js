'use strict';
// Run: node --test scripts/lib/scenario-uid-map.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { IXMP4_UID_BY_LEGACY, ixmp4UidFor, planScenarioRekey } = require('./scenario-uid-map');

const LIVE = [
  '2020 Climate Policies',
  '2020 Climate Policies then back to 1.5 °C',
  '2020 Climate Policies then Stabilisation',
  'Delayed Climate Action',
  'Delayed Climate Action then Net Zero',
  'Shifting Pathway',
  'Shifting Pathway then Net Zero',
  '2020 Climate Targets',
  '2020 Climate Targets then back to 1.5 °C',
  '2020 Climate Targets then back to 1 °C',
  '2020 Climate Targets then Stabilisation',
  'High Negative Emissions',
  'High Negative Emissions then Net Zero',
  'High Negative Emissions then back to 0 °C',
  'High Negative Emissions then Stabilisation',
  'High Renewables',
  'High Renewables then Net Zero CO2',
  'Low Demand',
  'Low Demand then Net Zero',
  'SSP1-1.9',
  'SSP1-1.9 (Extended)',
  'SSP5-3.4-Overshoot',
  'SSP5-3.4-Overshoot (Extended)',
  'Stabilisation at 1.5 °C',
  'Stabilisation at 1.5 °C (Extended)',
];

test('maps all 25 legacy scenario uids', () => {
  assert.equal(Object.keys(IXMP4_UID_BY_LEGACY).length, 25);
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
  assert.equal(ixmp4UidFor('ssp534-over'), 'SSP5-3.4-Overshoot');
  assert.equal(ixmp4UidFor('ref-1p5'), 'Stabilisation at 1.5 °C');
});

test('maps variants and corrected canonical spellings', () => {
  assert.equal(ixmp4UidFor('curpol-os'), '2020 Climate Policies then back to 1.5 °C');
  assert.equal(ixmp4UidFor('ssp534-over-extended'), 'SSP5-3.4-Overshoot (Extended)');
  assert.equal(ixmp4UidFor('SSP5-3.4-OS'), 'SSP5-3.4-Overshoot');
  assert.equal(ixmp4UidFor('Stabilisation At 1.5°C'), 'Stabilisation at 1.5 °C');
});

test('is case-insensitive on the legacy uid', () => {
  assert.equal(ixmp4UidFor('CurPol'), '2020 Climate Policies');
  assert.equal(ixmp4UidFor('SSP534-Over'), 'SSP5-3.4-Overshoot');
});

test('plans case-only corrections to the exact canonical name', () => {
  assert.deepEqual(planScenarioRekey([{ id: 1, locale: 'en', UID: '2020 climate policies' }]), [
    { id: 1, locale: 'en', from: '2020 climate policies', to: '2020 Climate Policies' },
  ]);
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
    { id: 1, locale: 'en-EU', UID: 'unknown' },
    { id: 2, locale: 'en-EU', UID: 'Today' },
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
