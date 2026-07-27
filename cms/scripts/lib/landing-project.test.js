'use strict';
// Run: node --test scripts/lib/landing-project.test.js
//
// The seeded defaults are written by hand against the vendored schemas, and
// Strapi silently drops unknown component fields — so the thing worth testing is
// that the two still agree.
const { test } = require('node:test');
const assert = require('node:assert');
const { LANDING_PROJECT } = require('./landing-project');
const { loadContentTypes, loadComponents } = require('./schema');

const components = loadComponents();
const landing = loadContentTypes().find((t) => t.singularName === 'landing-project');

test('the landing-project single type is vendored under src/api', () => {
  assert.ok(landing, 'no landing-project content type found');
  assert.equal(landing.kind, 'singleType');
  assert.equal(landing.i18n, true, 'the site fetches content per locale');
});

test('the block is two named cards, not a list — nobody can add a third', () => {
  assert.deepEqual(Object.keys(landing.attributes), ['Title', 'Intro', 'Highlights']);
  assert.equal(landing.attributes.Intro.repeatable, false);
  assert.equal(landing.attributes.Highlights.repeatable, false);
});

test('only the highlights card carries items', () => {
  const intro = components[landing.attributes.Intro.component];
  const highlights = components[landing.attributes.Highlights.component];
  assert.ok(intro && highlights, 'card components are missing');
  assert.ok(!intro.attributes.Items, 'the intro card should not offer an unused Items list');
  assert.equal(highlights.attributes.Items.repeatable, true);
});

test('the seeded defaults only use fields the schemas declare', () => {
  const assertFields = (value, attributes, what) => {
    for (const key of Object.keys(value)) {
      assert.ok(attributes[key], `${what} has no "${key}" attribute`);
    }
  };

  assertFields(LANDING_PROJECT, landing.attributes, 'landing-project');

  for (const field of ['Intro', 'Highlights']) {
    const component = components[landing.attributes[field].component];
    assertFields(LANDING_PROJECT[field], component.attributes, field);
  }

  const item = components[components[landing.attributes.Highlights.component].attributes.Items.component];
  for (const i of LANDING_PROJECT.Highlights.Items) {
    assertFields(i, item.attributes, 'project-highlight');
  }
});

test('the defaults reproduce the block as it shipped', () => {
  assert.match(LANDING_PROJECT.Title, /\n/, 'the heading keeps its editor-controlled line break');
  assert.equal(LANDING_PROJECT.Highlights.Items.length, 3);
  // Both cards had a call-to-action; a card with a label but no url renders no
  // link at all (see src/lib/content/landing-project.js).
  for (const field of ['Intro', 'Highlights']) {
    const card = LANDING_PROJECT[field];
    assert.ok(card.LinkLabel && card.LinkUrl, `${field} is missing half its link`);
  }
});
