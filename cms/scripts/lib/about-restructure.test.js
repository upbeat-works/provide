'use strict';
// Run: node --test scripts/lib/about-restructure.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const {
  restructureAbout,
  isRestructured,
  TARGET_TITLES,
  SPARCCLE_PLACEHOLDER,
} = require('./about-restructure');

// Mirrors the current live About page (Fly, en-EU): eight flat sections.
const current = [
  { Title: 'About the dashboard', Text: 'The PROVIDE climate risk dashboard is an interactive tool.' },
  { Title: 'Contributors', Text: '**Project lead:** Carl-Friedrich Schleussner' },
  { Title: 'Funding sources', Text: 'Funded by the European Union under grant No. 101003687.' },
  { Title: 'Sharing licence', Text: 'Made available under a Creative Commons CC BY-SA licence.' },
  { Title: 'How to cite', Text: '**How to cite the tool:**\n> Climate Analytics, 2022.' },
  { Title: 'Acknowledgements', Text: 'We would like to thank the research team.' },
  { Title: 'About the PROVIDE project', Text: 'The PROVIDE project aims to understand overshoot.' },
  { Title: 'About Climate Analytics', Text: 'Climate Analytics is a non-profit institute.' },
];

test('produces exactly the four target sections, in order', () => {
  const out = restructureAbout(current);
  assert.deepEqual(out.map((s) => s.Title), TARGET_TITLES);
});

test('the only ### (index dropdown) headings are the two projects', () => {
  const out = restructureAbout(current);
  const h3s = out.flatMap((s) => (s.Text.match(/^### .*/gm) || []));
  assert.deepEqual(h3s, ['### PROVIDE', '### SPARCCLE']);
});

test('About the dashboard keeps the intro and folds the orphans as #### (out of the index)', () => {
  const [about] = restructureAbout(current);
  assert.ok(about.Text.startsWith('The PROVIDE climate risk dashboard is an interactive tool.'));
  assert.match(about.Text, /#### Contributors\n\n\*\*Project lead:/);
  assert.match(about.Text, /#### About Climate Analytics\n\nClimate Analytics is a non-profit/);
  assert.match(about.Text, /#### Acknowledgements\n\nWe would like to thank/);
  // Folded sub-labels must be h4, never h3 — otherwise they'd appear in the index.
  assert.ok(!/^### /m.test(about.Text));
});

test('Projects carries PROVIDE copy plus a clearly-marked SPARCCLE placeholder', () => {
  const projects = restructureAbout(current)[1];
  assert.match(projects.Text, /### PROVIDE\n\nThe PROVIDE project aims to understand overshoot\./);
  assert.match(projects.Text, new RegExp(`### SPARCCLE\\n\\n${SPARCCLE_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('License & how to cite merges the licence and citation under #### sub-labels', () => {
  const license = restructureAbout(current)[3];
  assert.match(license.Text, /#### License\n\nMade available under a Creative Commons/);
  assert.match(license.Text, /#### How to cite\n\n\*\*How to cite the tool:/);
});

test('matches the older title variants (climate risk dashboard / sharing license)', () => {
  const older = [
    { Title: 'About the PROVIDE climate risk dashboard', Text: 'Older dashboard intro.' },
    { Title: 'Sharing license', Text: 'CC BY-SA.' },
    { Title: 'How to cite', Text: 'Cite this.' },
  ];
  const out = restructureAbout(older);
  assert.deepEqual(out.map((s) => s.Title), TARGET_TITLES);
  assert.ok(out[0].Text.startsWith('Older dashboard intro.'));
  assert.match(out[3].Text, /#### License\n\nCC BY-SA\./);
});

test('is idempotent — re-running returns the same array untouched', () => {
  const once = restructureAbout(current);
  assert.ok(isRestructured(once));
  const twice = restructureAbout(once);
  assert.strictEqual(twice, once); // same reference: detected as already-restructured
});

test('missing source sections do not throw and emit no empty #### headers', () => {
  const sparse = [{ Title: 'About the dashboard', Text: 'Only the intro exists.' }];
  const out = restructureAbout(sparse);
  assert.deepEqual(out.map((s) => s.Title), TARGET_TITLES);
  assert.equal(out[0].Text, 'Only the intro exists.'); // no dangling "#### Contributors" etc.
  assert.equal(out[2].Text, ''); // no funding source copy
  assert.ok(!out.some((s) => /#### \w+\n\n(?:$|\n|#)/.test(s.Text)));
});
