import { describe, test, expect } from 'vitest';
import { assignColors, defaultSelection, filterGroups, groupsOf, isPickable, pageCount, pageItems, rangeLabel } from './series-filter.js';

const group = (uid, label = uid) => ({ region: { uid, label }, series: [{ line: [] }] });
// The loader hands back countries in ISO-code order, so Bosnia (BA) arrives
// before Belgium (BE) and Czechia (CZ) before Germany (DE).
const result = { data: [group('Albania'), group('Austria'), group('Bosnia and Herzegovina'), group('Belgium'), group('Bulgaria')] };

const letters = (count) => Array.from({ length: count }, (_, i) => ({ uid: String.fromCharCode(97 + i), label: String.fromCharCode(97 + i) }));

describe('groupsOf', () => {
  test('sorts groups alphabetically by label, not by the order they arrived', () => {
    expect(groupsOf(result).map(({ uid }) => uid)).toEqual(['Albania', 'Austria', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria']);
  });

  test('reads scenario-grouped results too, and drops duplicates', () => {
    const scenarios = { data: [{ scenario: { uid: '1.5C', label: '1.5C' } }, { scenario: { uid: '1.5C', label: '1.5C' } }] };
    expect(groupsOf(scenarios)).toEqual([{ uid: '1.5C', label: '1.5C' }]);
  });

  test('has nothing to show for an ungrouped or empty result', () => {
    expect(groupsOf({ data: [{ line: [] }] })).toEqual([]);
    expect(groupsOf(undefined)).toEqual([]);
  });
});

describe('paging', () => {
  test('defaults to the first page worth, so the chart matches page one', () => {
    const groups = letters(27);
    expect(defaultSelection(groups)).toEqual(pageItems(groups, 1).items.map(({ uid }) => uid));
    expect(defaultSelection(groups)).toHaveLength(10);
  });

  test('counts pages and captions the range', () => {
    expect(pageCount(27)).toBe(3);
    expect(rangeLabel(letters(27), 1)).toBe('1–10 of 27');
    expect(rangeLabel(letters(27), 3)).toBe('21–27 of 27');
  });

  test('clamps a page beyond either end rather than emptying the picker', () => {
    expect(pageItems(letters(27), 9).page).toBe(3);
    expect(pageItems(letters(27), 0).page).toBe(1);
    expect(pageItems(letters(5), 1).items).toHaveLength(5);
  });

  test('keeps one page and a sane caption when there is nothing to show', () => {
    expect(pageCount(0)).toBe(1);
    expect(rangeLabel([], 1)).toBe('0 of 0');
  });
});

describe('assignColors', () => {
  test('gives each selected group its own slot', () => {
    expect(assignColors({}, ['a', 'b', 'c'], 12)).toEqual({ a: 0, b: 1, c: 2 });
  });

  test('leaves the others where they are when one is removed', () => {
    const first = assignColors({}, ['a', 'b', 'c'], 12);
    expect(assignColors(first, ['a', 'c'], 12)).toEqual({ a: 0, c: 2 });
  });

  test('gives a newly selected group the freed slot, not everyone a new one', () => {
    const after = assignColors({ a: 0, b: 1, c: 2 }, ['a', 'c'], 12);
    expect(assignColors(after, ['a', 'c', 'd'], 12)).toEqual({ a: 0, c: 2, d: 1 });
  });

  test('repeats hues only once the palette is exhausted', () => {
    const slots = Object.values(assignColors({}, ['a', 'b', 'c', 'd'], 3));
    expect(slots.slice(0, 3)).toEqual([0, 1, 2]);
    expect(slots[3]).toBeLessThan(3);
  });
});

describe('filterGroups', () => {
  test('narrows the data to the selection and leaves the rest of the result alone', () => {
    const filtered = filterGroups({ ...result, status: 'ready' }, ['Austria', 'Bulgaria']);
    expect(filtered.data.map(({ region }) => region.uid)).toEqual(['Austria', 'Bulgaria']);
    expect(filtered.status).toBe('ready');
  });

  test('passes an ungrouped result through untouched', () => {
    const ungrouped = { data: [{ line: [] }] };
    expect(filterGroups(ungrouped, []).data).toEqual(ungrouped.data);
  });
});

describe('isPickable', () => {
  const many = letters(12);

  test('offers the picker to line charts with groups to choose between', () => {
    expect(isPickable('line', many)).toBe(true);
    expect(isPickable('line_with_range', many)).toBe(true);
  });

  test('leaves other chart kinds alone, however many groups they draw', () => {
    expect(isPickable('bubble', many)).toBe(false);
    expect(isPickable('scatter', many)).toBe(false);
    expect(isPickable('stacked_bar', many)).toBe(false);
  });

  test('has nothing to offer a chart with one group or none', () => {
    expect(isPickable('line', letters(1))).toBe(false);
    expect(isPickable('line', [])).toBe(false);
    expect(isPickable(undefined, many)).toBe(false);
  });
});
