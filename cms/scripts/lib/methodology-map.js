'use strict';
/**
 * Pure reshape: the existing `methodology` (DataType[]) + `glossaries` content
 * into the new per-tab section lists — Models, Data processing, Key terms,
 * Impact. Mirrors scripts/strapi-export/pages.js so the CMS migration and the
 * markdown export stay in agreement. No I/O — unit tested in methodology-map.test.js.
 */

// Impact tab: each DataType (impact) splits into these categories, each sourced
// from the matching field on the DataType component.
const IMPACT_CATEGORIES = [
  ['Models', 'Model'],
  ['Model simulations', 'Simulation'],
  ['Data processing', 'Processing'],
];

const named = (arr) => (arr ?? []).filter((it) => (it?.Label ?? '').trim());
const toSection = (it) => ({ Title: it.Label.trim(), Text: it.Description ?? '' });

// Deduped (by label) union of a DataType field across every impact — feeds the
// top-level Models and Data processing tabs.
function unionSections(dataTypes, field) {
  const seen = new Set();
  const out = [];
  for (const dt of dataTypes ?? []) {
    for (const it of named(dt[field])) {
      const label = it.Label.trim();
      if (seen.has(label)) continue;
      seen.add(label);
      out.push(toSection(it));
    }
  }
  return out;
}

// Impact tab: flat sections carrying their Impact + Category grouping. NOT
// deduped — the same label can legitimately recur under different impacts.
function impactSections(dataTypes) {
  const out = [];
  for (const dt of dataTypes ?? []) {
    const impact = (dt.Label ?? '').trim();
    for (const [category, field] of IMPACT_CATEGORIES) {
      for (const it of named(dt[field])) {
        out.push({ Impact: impact, Category: category, Title: it.Label.trim(), Text: it.Description ?? '' });
      }
    }
  }
  return out;
}

function keyTermSections(glossaries) {
  return (glossaries ?? [])
    .filter((g) => (g?.Title ?? '').trim())
    .map((g) => ({ Title: g.Title.trim(), Text: g.Description ?? '' }));
}

function buildTabs(methodologyAttrs, glossaries) {
  const dataTypes = methodologyAttrs?.DataType ?? [];
  return {
    models: unionSections(dataTypes, 'Model'),
    dataProcessing: unionSections(dataTypes, 'Processing'),
    keyTerms: keyTermSections(glossaries),
    impact: impactSections(dataTypes),
  };
}

module.exports = { buildTabs, unionSections, impactSections, keyTermSections, IMPACT_CATEGORIES };
