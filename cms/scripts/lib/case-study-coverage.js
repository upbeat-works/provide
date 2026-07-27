'use strict';
// Legacy /meta cities each name the case study most relevant to them
// (`adaptationCaseStudy`). Invert that into per-case-study coverage: the biggest
// group becomes the default and enumerates nothing, the rest list their members.

function buildCoverage(cities, { defaultSlug } = {}) {
  const bySlug = new Map();
  for (const city of cities ?? []) {
    const slug = city?.adaptationCaseStudy;
    if (!slug || !city.uid) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(city.uid);
  }
  if (!bySlug.size) return [];

  const entries = [...bySlug.entries()].map(([slug, covers]) => ({ slug, covers: covers.sort() }));
  const fallback = defaultSlug ?? [...entries].sort((a, b) => b.covers.length - a.covers.length)[0].slug;

  return entries.map(({ slug, covers }) => (slug === fallback ? { slug, covers: [], isDefault: true } : { slug, covers, isDefault: false })).sort((a, b) => a.slug.localeCompare(b.slug));
}

module.exports = { buildCoverage };
