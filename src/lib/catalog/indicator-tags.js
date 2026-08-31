/**
 * The tag line under an indicator's description in the selection panel:
 * sector, the models it was produced with, its citations, and the project.
 */

/** Turn a curated sector slug (`terrestrial-climate`) into a label. */
export function sectorLabel(sector) {
  if (!sector) return '';
  return String(sector)
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Ordered, de-duplicated tag list for one indicator: sector, the model
 * citations verbatim, then the project. `sources` are deliberately excluded —
 * they belong to the chart footer, which labels them as such.
 */
export function indicatorTags(indicator) {
  const { sector, models = [], project } = indicator ?? {};
  const tags = [sectorLabel(sector), ...models, project];
  return [...new Set(tags.map((tag) => String(tag ?? '').trim()).filter(Boolean))];
}
