import { describe, test, expect } from 'bun:test';
import { distinct, caseInsensitiveLookup, distinctCaseInsensitive } from './util';

describe('distinct', () => {
  test('dedupes primitives, keeping first-seen order', () => {
    expect(distinct(['b', 'a', 'b', 'a', 'c'])).toEqual(['b', 'a', 'c']);
  });

  test('dedupes objects by a key function, keeping the first occurrence', () => {
    const items = [
      { id: 'x', n: 1 },
      { id: 'y', n: 2 },
      { id: 'x', n: 3 },
    ];
    expect(distinct(items, (i) => i.id)).toEqual([
      { id: 'x', n: 1 },
      { id: 'y', n: 2 },
    ]);
  });
});

describe('caseInsensitiveLookup', () => {
  test('maps an equivalently-cased name back to its canonical form', () => {
    const find = caseInsensitiveLookup(['SSP5-3.4-OS', '2020 Climate Policies']);
    expect(find('ssp5-3.4-os')).toBe('SSP5-3.4-OS');
    expect(find('SSP5-3.4-Os')).toBe('SSP5-3.4-OS');
    expect(find('2020 Climate Policies')).toBe('2020 Climate Policies');
  });

  test('returns undefined for a name not in the canonical set', () => {
    const find = caseInsensitiveLookup(['Today']);
    expect(find('SSP5-3.4-OS')).toBeUndefined();
  });
});

describe('distinctCaseInsensitive', () => {
  test('collapses case-only duplicates to the lexicographically smallest, preserving group order', () => {
    expect(
      distinctCaseInsensitive(['2020 Climate Policies', 'SSP5-3.4-Os', 'SSP5-3.4-OS', 'Today']),
    ).toEqual(['2020 Climate Policies', 'SSP5-3.4-OS', 'Today']);
  });

  test('leaves genuinely distinct names untouched, in order', () => {
    expect(distinctCaseInsensitive(['b', 'a', 'c'])).toEqual(['b', 'a', 'c']);
  });
});
