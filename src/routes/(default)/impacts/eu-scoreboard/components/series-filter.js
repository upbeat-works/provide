// Choosing which groups a grouped chart draws. Selecting "all countries" turns
// every chart into one mark per country — forty of them on a line chart, which
// is more ink than anyone can read. These are the pure parts: which groups a
// result holds, which are shown by default, how the picker pages through them,
// and which colour each one keeps.

import colorTokens from '$styles/color-tokens-light.json';

export const PAGE_SIZE = 10;

// One hue per group. `category` carries three, which is right for a chart with
// a handful of series and repeats every third country on one with forty; this
// ramp is the categorical set those charts draw from. Read off the tokens so
// the picker's swatches and the chart's lines cannot drift apart.
export const SERIES_COLORS = Object.values(colorTokens.series.base);
export const colorOf = (slot) => SERIES_COLORS[slot % SERIES_COLORS.length];

// Only line charts offer the picker. Lines are what become unreadable in bulk —
// forty of them cross and hide one another — while a bar or bubble chart draws
// one labelled mark per group and stays legible. It is also the only path the
// adapter colours by group, so a coloured swatch beside a country name would be
// telling the truth here and nowhere else.
export const PICKABLE_TYPES = ['line', 'line_with_range'];
export const isPickable = (chartType, groups = []) => groups.length > 1 && PICKABLE_TYPES.includes(chartType);

/**
 * The groups a chart result carries, in alphabetical order by label.
 *
 * Sorting here is not cosmetic. The loader returns countries in the order
 * `SCOREBOARD_COUNTRIES` lists them, which is by ISO code — so Bosnia and
 * Herzegovina (BA) arrives before Belgium (BE). A picker in that order looks
 * broken, and the first ten of it are not the first ten anyone would name.
 */
export function groupsOf(result) {
  const entries = Array.isArray(result?.data) ? result.data : [];
  const groups = entries.flatMap((entry) => {
    const group = entry?.region ?? entry?.scenario;
    if (!group?.uid) return [];
    return [{ uid: String(group.uid), label: String(group.label ?? group.uid) }];
  });
  const seen = new Set();
  return groups
    .filter(({ uid }) => !seen.has(uid) && seen.add(uid))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// The first page's worth, so what the chart opens with is exactly what the
// picker's first page shows checked — no hunting across pages for the ten that
// happen to be lit.
export const defaultSelection = (groups, limit = PAGE_SIZE) => groups.slice(0, limit).map(({ uid }) => uid);

export const pageCount = (total, perPage = PAGE_SIZE) => Math.max(1, Math.ceil(total / perPage));

// Clamped rather than wrapped: paging past the end should stop, and a selection
// that shrinks under the current page should not leave the picker blank.
export function pageItems(groups, page, perPage = PAGE_SIZE) {
  const last = pageCount(groups.length, perPage);
  const index = Math.min(Math.max(page, 1), last);
  const start = (index - 1) * perPage;
  return { page: index, pages: last, start, items: groups.slice(start, start + perPage) };
}

// "1–10 of 27", the picker's own caption.
export function rangeLabel(groups, page, perPage = PAGE_SIZE) {
  const { start, items } = pageItems(groups, page, perPage);
  if (!items.length) return `0 of ${groups.length}`;
  return `${start + 1}–${start + items.length} of ${groups.length}`;
}

/**
 * Which palette slot each selected group holds.
 *
 * A group keeps its slot for as long as it stays selected, and a newly selected
 * one takes the lowest slot nobody is using. Assigning by position in the
 * selection instead would recolour every line below the one you just unchecked,
 * which makes a chart impossible to follow while you adjust it.
 */
export function assignColors(previous = {}, selected = [], size = 1) {
  const slots = Math.max(size, 1);
  const kept = {};
  const taken = new Set();
  for (const uid of selected) {
    const slot = previous[uid];
    if (slot === undefined || slot >= slots || taken.has(slot)) continue;
    kept[uid] = slot;
    taken.add(slot);
  }
  // Past the palette's size there is no free slot left to give, so hues repeat
  // — unavoidable with more groups selected than the palette has colours.
  let overflow = 0;
  for (const uid of selected) {
    if (kept[uid] !== undefined) continue;
    let slot = 0;
    while (slot < slots && taken.has(slot)) slot += 1;
    if (slot === slots) slot = overflow++ % slots;
    else taken.add(slot);
    kept[uid] = slot;
  }
  return kept;
}

/** The result with its groups narrowed to the selection, order preserved. */
export function filterGroups(result, selected) {
  if (!Array.isArray(result?.data) || !selected) return result;
  const wanted = new Set(selected);
  return {
    ...result,
    data: result.data.filter((entry) => {
      const group = entry?.region ?? entry?.scenario;
      return group?.uid === undefined || wanted.has(String(group.uid));
    }),
  };
}
