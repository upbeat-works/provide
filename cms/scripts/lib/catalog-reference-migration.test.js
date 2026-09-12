'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { planCatalogReferenceMigration } = require('./catalog-reference-migration');

const legacyIds = [
  'urbclim-T2M-dayoverX',
  'urbclim-T2M-nightoverX',
  'urbclim-WBGT-dayover31',
  'urbclim-WBGT-dayover295',
  'urbclim-cooling-degree-hours',
  'urbclim-LWH-int',
  'urbclim-heatwave-days',
  'urbclim-heatwaves-population-exposed',
];

function repositoryFixture() {
  return {
    impactGeoSnapshots: legacyIds.map((indicator, index) => ({ id: index + 1, indicator })),
    impactTimeSnapshots: [{ id: 1, indicator: legacyIds[0] }],
    avoidingIndicators: [{ id: 1, uid: legacyIds[6] }],
    explorerUrls: [
      {
        id: 1,
        table: 'components_future_impacts_future_impacts',
        url: '/impacts/explore?indicator=urbclim-WBGT-dayover295&geography=lisbon&scenarios%5B0%5D=curpol&scenarios%5B1%5D=sp&time=annual&reference=present-day&spatial=area',
      },
      {
        id: 2,
        table: 'components_avoiding_impacts_avoiding_impacts',
        url: '/impacts/avoid?indicator=urbclim-heatwave-days&geography=islamabad&scenarios%5B0%5D=curpol&time=annual&reference=absolute&spatial=area&indicator_value=28',
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        id: index + 3,
        table: 'components_future_impacts_future_impacts',
        url: '/impacts/explore?indicator=urbclim-heatwaves-population-exposed&geography=lisbon&scenarios%5B0%5D=sp&time=annual&reference=absolute&spatial=area',
      })),
    ],
  };
}

test('plans exact source-bound updates for all repository reference shapes', () => {
  const plan = planCatalogReferenceMigration(repositoryFixture());

  assert.deepEqual(
    plan.impactGeoSnapshots.map(({ indicator, instance }) => ({ indicator, instance })),
    [
      { indicator: 'Days a Year with Maximum Temperatures Above X°C', instance: 'provide-internal' },
      { indicator: 'Nights a Year with Minimum Temperatures Above X°C', instance: 'provide-internal' },
      { indicator: 'Days a Year with Extreme Heat Stress', instance: 'provide-internal' },
      { indicator: 'Days a Year with Very High Heat Stress', instance: 'provide-internal' },
      { indicator: 'Cooling Degree Hours', instance: 'provide-internal' },
      { indicator: 'Lost Working Hours per Year for Intense Activities', instance: 'provide-internal' },
      { indicator: 'Heatwave Days per Year', instance: 'provide-internal' },
      { indicator: 'Population Exposed to Heatwaves', instance: 'provide-internal' },
    ]
  );
  assert.equal(plan.impactTimeSnapshots[0].instance, 'provide-internal');
  assert.deepEqual(plan.avoidingIndicators[0], {
    id: 1,
    uid: 'Heatwave Days per Year',
    instance: 'provide-internal',
  });
  assert.equal(
    plan.explorerUrls[0].url,
    '/impacts/explore?indicator=Days+a+Year+with+Very+High+Heat+Stress&geography=Lisbon&scenarios%5B0%5D=2020+Climate+Policies&scenarios%5B1%5D=Shifting+Pathway&time=Annual&reference=2011-2020+%28Present+Day%29&spatial=Area&instance=provide-internal'
  );
  assert.equal(plan.explorerUrls.length, 12);
  assert.equal(
    plan.explorerUrls[1].url,
    '/impacts/avoid?indicator=Heatwave+Days+per+Year&geography=Islamabad&scenarios%5B0%5D=2020+Climate+Policies&time=Annual&reference=2011-2020+%28Present+Day%29&spatial=Area&indicator_value=28&instance=provide-internal'
  );
});

test('rejects the whole plan when any indicator is unknown or lacks an instance', () => {
  const unknown = repositoryFixture();
  unknown.impactTimeSnapshots.push({ id: 2, indicator: 'urbclim-unknown' });
  assert.throws(() => planCatalogReferenceMigration(unknown), /Unknown indicator/);

  const missing = repositoryFixture();
  missing.impactTimeSnapshots = [{ id: 1, indicator: 'Heatwave Days per Year' }];
  assert.throws(() => planCatalogReferenceMigration(missing), /instance/);
});

test('leaves canonical repository input unchanged', () => {
  const first = planCatalogReferenceMigration(repositoryFixture());
  assert.deepEqual(planCatalogReferenceMigration(first), first);
});

test('rejects unsafe and unmapped Explorer URLs', () => {
  for (const url of ['https://evil.example/impacts/explore', '/impacts/explore?indicator=urbclim-unknown&geography=lisbon', '/impacts/expl\nore']) {
    const repository = repositoryFixture();
    repository.explorerUrls = [{ id: 9, table: 'x', url }];
    assert.throws(() => planCatalogReferenceMigration(repository));
  }
});

test('does not add a question mark to a safe URL without a query', () => {
  const repository = repositoryFixture();
  repository.explorerUrls = [{ id: 9, table: 'x', url: '/impacts/explore' }];
  assert.equal(planCatalogReferenceMigration(repository).explorerUrls[0].url, '/impacts/explore');
});
