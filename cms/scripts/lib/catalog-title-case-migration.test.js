'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { planCatalogReferenceMigration } = require('./catalog-reference-migration');
const { planCatalogTitleCaseMigration } = require('./catalog-title-case-migration');

test('updates stored canonical indicator references and Explorer URLs to title case', () => {
  const plan = planCatalogTitleCaseMigration({
    impactGeoSnapshots: [{ id: 1, indicator: 'Days a year with extreme heat stress', instance: 'provide-internal' }],
    impactTimeSnapshots: [{ id: 2, indicator: 'Cooling degree hours', instance: 'provide-internal' }],
    avoidingIndicators: [{ id: 3, uid: 'Heatwave days per year', instance: 'provide-internal' }],
    explorerUrls: [{ id: 4, table: 'future', url: '/impacts/explore?indicator=Lost+working+hours+per+year+for+intense+activities&geography=Lisbon' }],
  });

  assert.equal(plan.impactGeoSnapshots[0].indicator, 'Days a Year with Extreme Heat Stress');
  assert.equal(plan.impactTimeSnapshots[0].indicator, 'Cooling Degree Hours');
  assert.equal(plan.avoidingIndicators[0].uid, 'Heatwave Days per Year');
  assert.equal(plan.explorerUrls[0].url, '/impacts/explore?indicator=Lost+Working+Hours+per+Year+for+Intense+Activities&geography=Lisbon');
});

test('leaves unrelated values unchanged and is idempotent', () => {
  const repository = {
    impactGeoSnapshots: [{ id: 1, indicator: 'Mean Temperature', instance: 'provide-internal' }],
    impactTimeSnapshots: [],
    avoidingIndicators: [],
    explorerUrls: [{ id: 2, table: 'future', url: '/impacts/explore?geography=Lisbon' }],
  };
  const first = planCatalogTitleCaseMigration(repository);
  assert.deepEqual(planCatalogTitleCaseMigration(first), first);
  assert.deepEqual(first, repository);
});

test('covers technical tokens and preserves absolute URL fragments and other parameters', () => {
  const plan = planCatalogTitleCaseMigration({
    impactGeoSnapshots: [{ id: 1, indicator: 'Global atmospheric CH4 concentration from peatland emissions' }],
    impactTimeSnapshots: [{ id: 2, indicator: 'Heat-wave magnitude index daily (HWMId)' }],
    avoidingIndicators: [],
    explorerUrls: [{ id: 3, table: 'future', url: 'https://provide.example/impacts/explore?indicator=Sea+surface+pH&note=keep#chart' }],
  });
  assert.equal(plan.impactGeoSnapshots[0].indicator, 'Global Atmospheric CH4 Concentration from Peatland Emissions');
  assert.equal(plan.impactTimeSnapshots[0].indicator, 'Heat-Wave Magnitude Index Daily (HWMId)');
  assert.equal(plan.explorerUrls[0].url, 'https://provide.example/impacts/explore?indicator=Sea+Surface+pH&note=keep#chart');
});

test('does not rewrite an unknown legacy indicator in a stored URL', () => {
  const repository = {
    impactGeoSnapshots: [],
    impactTimeSnapshots: [],
    avoidingIndicators: [],
    explorerUrls: [{ id: 1, table: 'avoid', url: '/impacts/avoid?indicator=urbclim-heatwave-days&note=keep#chart' }],
  };
  assert.deepEqual(planCatalogTitleCaseMigration(repository), repository);
});

test('preserves URL fragments through the canonical and title-case migration chain', () => {
  const repository = {
    impactGeoSnapshots: [],
    impactTimeSnapshots: [],
    avoidingIndicators: [],
    explorerUrls: [{ id: 1, table: 'future', url: '/impacts/explore?indicator=urbclim-heatwave-days&geography=lisbon#chart' }],
  };
  const canonical = planCatalogReferenceMigration(repository);
  const titled = planCatalogTitleCaseMigration(canonical);
  assert.equal(titled.explorerUrls[0].url, '/impacts/explore?indicator=Heatwave+Days+per+Year&geography=Lisbon&instance=provide-internal#chart');
});
