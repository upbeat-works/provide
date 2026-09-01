import { describe, test, expect } from 'bun:test';
import { comparisonViews, seedComparison } from './comparison.js';

const options = [{ uid: 'a' }, { uid: 'b' }, { uid: 'c' }];

describe('seedComparison', () => {
  test('opens on the current value and the next one along', () => {
    expect(seedComparison(options, { uid: 'a' })).toEqual([{ uid: 'a' }, { uid: 'b' }]);
    expect(seedComparison(options, { uid: 'b' })).toEqual([{ uid: 'b' }, { uid: 'c' }]);
  });

  test('wraps at the end, so the two sides are never the same', () => {
    const [left, right] = seedComparison(options, { uid: 'c' });
    expect(right).not.toEqual(left);
    expect(right).toEqual({ uid: 'a' });
  });

  test('starts at the first option when there is no current value', () => {
    // "All countries" is a real selection with no option of its own.
    expect(seedComparison(options, undefined)).toEqual([undefined, { uid: 'a' }]);
  });

  test('survives an empty list rather than reading past its end', () => {
    expect(seedComparison([], { uid: 'a' })).toEqual([{ uid: 'a' }, { uid: 'a' }]);
  });
});

describe('comparisonViews', () => {
  const shared = { scenario: 's', year: 2025, geography: undefined };

  test('leaves the selection alone when not comparing', () => {
    expect(comparisonViews(undefined, [], shared)).toEqual([shared]);
  });

  test('overrides only the compared dimension, per side', () => {
    expect(comparisonViews('year', [2025, 2026], shared)).toEqual([
      { scenario: 's', year: 2025, geography: undefined },
      { scenario: 's', year: 2026, geography: undefined },
    ]);
  });
});
