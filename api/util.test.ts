import { describe, test, expect } from 'bun:test';
import { distinct } from './util';

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
