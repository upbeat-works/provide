'use strict';
/**
 * Pure reshape of the About page's flat Section list into the four-section
 * information architecture that drives the sidebar index (NestedNav derives the
 * index from the rendered h2/h3 headings, so this reshape defines the menu too):
 *
 *   1. About the dashboard    (h2) — dashboard intro, then Contributors,
 *                                     About Climate Analytics and Acknowledgements
 *                                     folded in as #### so they render as content
 *                                     but stay OUT of the index (nav reads h2/h3).
 *   2. Projects               (h2) — one ### child per project → index dropdown.
 *                                     PROVIDE (from the existing copy) + a clearly
 *                                     marked SPARCCLE placeholder.
 *   3. Funding sources        (h2) — existing copy, unchanged.
 *   4. License & how to cite  (h2) — Sharing licence + How to cite merged, each
 *                                     under a #### sub-label (kept out of the index).
 *
 * Idempotent: if `sections` is already in the target shape it is returned
 * unchanged (same reference), so the runner can safely re-run. No I/O — unit
 * tested in about-restructure.test.js.
 */

const TARGET_TITLES = ['About the dashboard', 'Projects', 'Funding sources', 'License & how to cite'];

const SPARCCLE_PLACEHOLDER = '_Placeholder: add a short description of the SPARCCLE project here._';

// Accepted title variants (normalized) for each source section. Covers the
// current Fly copy and the older "About the PROVIDE climate risk dashboard" /
// "Sharing licence" wording so the reshape works against any recent snapshot.
const SOURCE = {
  dashboard: ['about the dashboard', 'about the provide climate risk dashboard', 'about the provide dashboard'],
  contributors: ['contributors'],
  climateAnalytics: ['about climate analytics'],
  acknowledgements: ['acknowledgements', 'acknowledgments'],
  provideProject: ['about the provide project'],
  funding: ['funding sources'],
  licence: ['sharing licence', 'sharing license', 'license', 'licence'],
  cite: ['how to cite'],
};

const norm = (s) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// Trimmed Text of the first section whose title matches one of `variants`, or ''.
function findText(sections, variants) {
  const set = new Set(variants);
  const hit = (sections ?? []).find((s) => set.has(norm(s.Title)));
  return (hit?.Text ?? '').trim();
}

// Join non-empty blocks with a blank line between them (markdown paragraph break).
function joinBlocks(blocks) {
  return blocks.filter((b) => b && b.trim()).join('\n\n');
}

const sub = (label, text) => (text ? `#### ${label}\n\n${text}` : '');

function isRestructured(sections) {
  return (
    Array.isArray(sections) &&
    sections.length === TARGET_TITLES.length &&
    sections.every((s, i) => norm(s.Title) === norm(TARGET_TITLES[i]))
  );
}

function restructureAbout(sections) {
  if (isRestructured(sections)) return sections;

  const dashboard = findText(sections, SOURCE.dashboard);
  const contributors = findText(sections, SOURCE.contributors);
  const climateAnalytics = findText(sections, SOURCE.climateAnalytics);
  const acknowledgements = findText(sections, SOURCE.acknowledgements);
  const provideProject = findText(sections, SOURCE.provideProject);
  const funding = findText(sections, SOURCE.funding);
  const licence = findText(sections, SOURCE.licence);
  const cite = findText(sections, SOURCE.cite);

  const aboutBody = joinBlocks([
    dashboard,
    sub('Contributors', contributors),
    sub('About Climate Analytics', climateAnalytics),
    sub('Acknowledgements', acknowledgements),
  ]);

  const projectsBody = joinBlocks([
    joinBlocks(['### PROVIDE', provideProject]),
    joinBlocks(['### SPARCCLE', SPARCCLE_PLACEHOLDER]),
  ]);

  const licenseBody = joinBlocks([sub('License', licence), sub('How to cite', cite)]);

  return [
    { Title: 'About the dashboard', Text: aboutBody },
    { Title: 'Projects', Text: projectsBody },
    { Title: 'Funding sources', Text: funding },
    { Title: 'License & how to cite', Text: licenseBody },
  ];
}

module.exports = { restructureAbout, isRestructured, TARGET_TITLES, SPARCCLE_PLACEHOLDER, SOURCE };
