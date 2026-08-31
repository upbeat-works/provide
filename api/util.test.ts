import { describe, test, expect } from 'bun:test';
import { distinct, caseInsensitiveLookup, distinctCaseInsensitive, createTtlCache } from './util';

describe('createTtlCache', () => {
  test('serves the cached value within the TTL without recomputing', async () => {
    let clock = 1000;
    const cache = createTtlCache<number>(100, () => clock);
    let calls = 0;
    const compute = async () => {
      calls++;
      return 42;
    };
    expect(await cache.get('k', compute)).toBe(42);
    clock = 1050; // still inside the 100ms window
    expect(await cache.get('k', compute)).toBe(42);
    expect(calls).toBe(1);
  });

  test('recomputes once the TTL has elapsed', async () => {
    let clock = 0;
    const cache = createTtlCache<number>(100, () => clock);
    let calls = 0;
    const compute = async () => {
      calls++;
      return calls;
    };
    expect(await cache.get('k', compute)).toBe(1);
    clock = 101; // past the window
    expect(await cache.get('k', compute)).toBe(2);
    expect(calls).toBe(2);
  });

  test('keeps entries independent per key', async () => {
    const cache = createTtlCache<string>(10_000);
    expect(await cache.get('a', async () => 'A')).toBe('A');
    expect(await cache.get('b', async () => 'B')).toBe('B');
    // 'a' is still cached — the fresh compute must not run.
    expect(await cache.get('a', async () => 'A2')).toBe('A');
  });

  test('clear() forces the next get to recompute', async () => {
    const cache = createTtlCache<number>(10_000);
    let calls = 0;
    const compute = async () => {
      calls++;
      return calls;
    };
    await cache.get('k', compute);
    cache.clear();
    await cache.get('k', compute);
    expect(calls).toBe(2);
  });

  test('does not cache a rejected computation, so the next get retries', async () => {
    const cache = createTtlCache<number>(10_000);
    let calls = 0;
    const compute = async () => {
      calls++;
      if (calls === 1) throw new Error('boom');
      return calls;
    };
    await expect(cache.get('k', compute)).rejects.toThrow('boom');
    expect(await cache.get('k', compute)).toBe(2);
  });

  test('shares one in-flight computation between concurrent cold callers', async () => {
    const cache = createTtlCache<number>(10_000);
    let calls = 0;
    const compute = async () => {
      calls++;
      return calls;
    };
    const [a, b] = await Promise.all([cache.get('k', compute), cache.get('k', compute)]);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(calls).toBe(1);
  });
});

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
