'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { planScenarioReferenceMigration } = require('./scenario-reference-migration');

test('updates scenario rows and every indexed Explorer scenario parameter', () => {
  const plan = planScenarioReferenceMigration({
    scenarios: [
      { id: 1, uid: 'ssp534-over' },
      { id: 2, uid: 'Stabilisation At 1.5°C' },
    ],
    explorerUrls: [{ id: 3, table: 'future', url: '/impacts/explore?scenarios%5B0%5D=curpol-os&note=keep&scenarios%5B1%5D=ref-1p5#chart' }],
  });
  assert.deepEqual(plan.scenarios.map(({ uid }) => uid), ['SSP5-3.4-Overshoot', 'Stabilisation at 1.5 °C']);
  assert.equal(plan.explorerUrls[0].url, '/impacts/explore?scenarios%5B0%5D=2020+Climate+Policies+then+back+to+1.5+%C2%B0C&note=keep&scenarios%5B1%5D=Stabilisation+at+1.5+%C2%B0C#chart');
});

test('preserves unknown rows, URLs, links, and fragments and is idempotent', () => {
  const repository = {
    scenarios: [{ id: 1, uid: 'Unknown Scenario' }],
    explorerUrls: [{ id: 2, table: 'future', url: 'https://provide.example/impacts/explore?scenarios%5B0%5D=Unknown+Scenario&link=https%3A%2F%2Fexample.test%2Fx#anchor' }],
  };
  const first = planScenarioReferenceMigration(repository);
  assert.deepEqual(first, repository);
  assert.deepEqual(planScenarioReferenceMigration(first), first);
});
