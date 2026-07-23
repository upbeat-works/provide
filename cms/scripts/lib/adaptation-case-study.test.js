'use strict';
// Run: node --test scripts/lib/adaptation-case-study.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const {
  rewriteLinks,
  buildPublicationsMarkdown,
  buildAdaptationCaseStudy,
} = require('./adaptation-case-study');

// The real source snapshot downloaded from the original Strapi single type
// (https://provide-cms.herokuapp.com/api/adaptation). Using it keeps the tests
// honest about the exact content being migrated.
const source = require('./adaptation-source.json');

// ---- rewriteLinks -----------------------------------------------------------

test('rewriteLinks converts the old climateanalytics.org domain to a relative path', () => {
  const out = rewriteLinks('See the [avoid mode](https://climate-risk-dashboard.climateanalytics.org/impacts/avoid).');
  assert.strictEqual(out, 'See the [avoid mode](/impacts/avoid).');
});

test('rewriteLinks maps old /adaptation/<city> links onto /case-studies/<city>', () => {
  assert.strictEqual(rewriteLinks('[Nassau](/adaptation/nassau)'), '[Nassau](/case-studies/nassau)');
  assert.strictEqual(
    rewriteLinks('[example](/adaptation/nassau#context)'),
    '[example](/case-studies/nassau#context)'
  );
});

test('rewriteLinks turns same-page /adaptation#anchor links into bare #anchor links', () => {
  assert.strictEqual(
    rewriteLinks('[tool](/adaptation#overshoot-proofing-self-assessment-tool)'),
    '[tool](#overshoot-proofing-self-assessment-tool)'
  );
});

test('rewriteLinks remaps the publications anchor to the new section heading id', () => {
  // The publications section is titled "Relevant PROVIDE publications" whose
  // kebab-cased heading id is "relevant-provide-publications".
  assert.strictEqual(
    rewriteLinks('[pubs](/adaptation#provide-publications-on-adaptation)'),
    '[pubs](#relevant-provide-publications)'
  );
});

test('rewriteLinks leaves genuinely external links and local assets untouched', () => {
  const external = '[EEA](https://climate-adapt.eea.europa.eu/en/x) and ![img](https://res.cloudinary.com/dnbfqmwzt/image/upload/x.png)';
  assert.strictEqual(rewriteLinks(external), external);
  const pdf = '[download](/documents/overshoot-proofing-self-assessment-tool.pdf)';
  assert.strictEqual(rewriteLinks(pdf), pdf);
});

test('rewriteLinks is null-safe', () => {
  assert.strictEqual(rewriteLinks(undefined), '');
  assert.strictEqual(rewriteLinks(null), '');
});

// ---- buildPublicationsMarkdown ---------------------------------------------

test('buildPublicationsMarkdown renders one markdown link per publication, in order', () => {
  const md = buildPublicationsMarkdown([
    { Name: 'First report ', Url: 'https://example.com/a.pdf' },
    { Name: 'Second paper', Url: 'https://example.com/b' },
  ]);
  assert.strictEqual(md, '- [First report](https://example.com/a.pdf)\n- [Second paper](https://example.com/b)');
});

test('buildPublicationsMarkdown handles an empty list', () => {
  assert.strictEqual(buildPublicationsMarkdown([]), '');
  assert.strictEqual(buildPublicationsMarkdown(undefined), '');
});

// ---- buildAdaptationCaseStudy ----------------------------------------------

test('buildAdaptationCaseStudy accepts either the full JSON or the attributes object', () => {
  const fromFull = buildAdaptationCaseStudy(source);
  const fromAttrs = buildAdaptationCaseStudy(source.data.attributes);
  assert.deepStrictEqual(fromFull, fromAttrs);
});

test('buildAdaptationCaseStudy sets the slug, title and abstract', () => {
  const cs = buildAdaptationCaseStudy(source);
  assert.strictEqual(cs.CityUid, 'adaptation');
  assert.strictEqual(cs.Title, 'Climate risk dashboard for adaptation support');
  assert.strictEqual(cs.Abstract, source.data.attributes.Description);
});

test('buildAdaptationCaseStudy derives PublicationDate (YYYY-MM-DD) from the source updatedAt', () => {
  const cs = buildAdaptationCaseStudy(source);
  assert.strictEqual(cs.PublicationDate, '2024-06-27');
});

test('buildAdaptationCaseStudy produces five section components in order', () => {
  const cs = buildAdaptationCaseStudy(source);
  assert.strictEqual(cs.MainContent.length, 5);
  assert.ok(cs.MainContent.every((s) => s.__component === 'section.section'));
  assert.deepStrictEqual(
    cs.MainContent.map((s) => s.Title),
    [
      'Using the climate risk dashboard for adaptation planning',
      'Overshoot Proofing Self-Assessment Tool',
      'Integrating limits in long-term adaptation planning',
      'Relevant PROVIDE publications',
      'Analysis for your city',
    ]
  );
});

test('buildAdaptationCaseStudy does not repeat the page title as the first section heading', () => {
  const cs = buildAdaptationCaseStudy(source);
  assert.notStrictEqual(cs.MainContent[0].Title, cs.Title);
});

test('buildAdaptationCaseStudy rewrites links inside the section bodies', () => {
  const cs = buildAdaptationCaseStudy(source);
  const allText = cs.MainContent.map((s) => s.Text).join('\n');
  // No stale routes or old domain survive.
  assert.ok(!allText.includes('/adaptation/'), 'no /adaptation/ city links remain');
  assert.ok(!/\]\(\/adaptation[#)]/.test(allText), 'no bare /adaptation links remain');
  assert.ok(!allText.includes('climateanalytics.org'), 'no old domain remains');
  // The new routes are present.
  assert.ok(allText.includes('/case-studies/nassau'), 'city links point at /case-studies');
});

test('buildAdaptationCaseStudy self-assessment section keeps the anchor-matching heading', () => {
  const cs = buildAdaptationCaseStudy(source);
  const { kebabCase } = require('lodash');
  const selfAssessment = cs.MainContent[1];
  // The IntroText links to #overshoot-proofing-self-assessment-tool, which must
  // match this section's generated heading id.
  assert.strictEqual(kebabCase(selfAssessment.Title), 'overshoot-proofing-self-assessment-tool');
  const intro = cs.MainContent[0];
  assert.ok(intro.Text.includes('#overshoot-proofing-self-assessment-tool'));
});

test('buildAdaptationCaseStudy publications section lists all seven publications as links', () => {
  const cs = buildAdaptationCaseStudy(source);
  const pubs = cs.MainContent[3];
  const lines = pubs.Text.split('\n').filter(Boolean);
  assert.strictEqual(lines.length, 7);
  assert.ok(lines.every((l) => /^- \[.+\]\(https?:\/\/.+\)$/.test(l)), 'every line is a markdown link');
});

test('buildAdaptationCaseStudy accepts an override slug/title', () => {
  const cs = buildAdaptationCaseStudy(source, { slug: 'adapt', title: 'X' });
  assert.strictEqual(cs.CityUid, 'adapt');
  assert.strictEqual(cs.Title, 'X');
});
