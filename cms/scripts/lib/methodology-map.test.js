'use strict';
// Run: node --test scripts/lib/methodology-map.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { buildTabs } = require('./methodology-map');

const methodology = {
  DataType: [
    {
      Label: 'Glaciers',
      Model: [
        { Label: 'OGGM', Description: 'oggm desc' },
        { Label: '  ', Description: 'blank label, skipped' },
      ],
      Simulation: [{ Label: 'OGGM simulations', Description: 'sim desc' }],
      Processing: [{ Label: 'Maps', Description: 'maps desc' }],
    },
    {
      Label: 'Sea level rise',
      Model: [
        { Label: 'MAGICC', Description: 'magicc desc' },
        { Label: 'OGGM', Description: 'duplicate across impacts, dropped from union' },
      ],
      Simulation: [],
      Processing: [{ Label: 'Maps', Description: 'dup maps in union, dropped' }],
    },
  ],
};
const glossaries = [
  { Title: 'Overshoot', Description: 'os desc' },
  { Title: '   ', Description: 'blank title, skipped' },
];

test('Models tab = deduped union of DataType.Model (blank labels skipped)', () => {
  const { models } = buildTabs(methodology, glossaries);
  assert.deepEqual(
    models,
    [
      { Title: 'OGGM', Text: 'oggm desc' },
      { Title: 'MAGICC', Text: 'magicc desc' },
    ],
  );
});

test('Data processing tab = deduped union of DataType.Processing', () => {
  const { dataProcessing } = buildTabs(methodology, glossaries);
  assert.deepEqual(dataProcessing, [{ Title: 'Maps', Text: 'maps desc' }]);
});

test('Key terms tab = glossaries with a non-blank title', () => {
  const { keyTerms } = buildTabs(methodology, glossaries);
  assert.deepEqual(keyTerms, [{ Title: 'Overshoot', Text: 'os desc' }]);
});

test('Impact tab = per impact x category, not deduped, blanks skipped', () => {
  const { impact } = buildTabs(methodology, glossaries);
  assert.deepEqual(impact, [
    { Impact: 'Glaciers', Category: 'Models', Title: 'OGGM', Text: 'oggm desc' },
    { Impact: 'Glaciers', Category: 'Model simulations', Title: 'OGGM simulations', Text: 'sim desc' },
    { Impact: 'Glaciers', Category: 'Data processing', Title: 'Maps', Text: 'maps desc' },
    { Impact: 'Sea level rise', Category: 'Models', Title: 'MAGICC', Text: 'magicc desc' },
    { Impact: 'Sea level rise', Category: 'Models', Title: 'OGGM', Text: 'duplicate across impacts, dropped from union' },
    { Impact: 'Sea level rise', Category: 'Data processing', Title: 'Maps', Text: 'dup maps in union, dropped' },
  ]);
});

test('empty inputs do not throw', () => {
  assert.deepEqual(buildTabs(null, null), { models: [], dataProcessing: [], keyTerms: [], impact: [] });
});
