export interface TtlCache<T> {
  /** Return the cached value for `key`, or compute + store it (shared in-flight). */
  get(key: string, compute: () => Promise<T>): Promise<T>;
  /** Drop all entries (e.g. between tests). */
  clear(): void;
}

/**
 * A tiny in-memory time-to-live cache for expensive, rarely-changing async work
 * (e.g. the ixmp4 catalog scan). Entries expire after `ttlMs`; the clock is
 * injectable so expiry is testable without waiting. Concurrent cold callers share
 * one in-flight computation, and a rejected computation is not cached.
 */
export function createTtlCache<T>(ttlMs: number, now: () => number = Date.now): TtlCache<T> {
  // Store the in-flight Promise (not the resolved value) so concurrent cold
  // callers share one computation.
  const entries = new Map<string, { value: Promise<T>; expiresAt: number }>();
  return {
    get(key, compute) {
      const hit = entries.get(key);
      if (hit && hit.expiresAt > now()) return hit.value;
      const entry = { value: compute(), expiresAt: now() + ttlMs };
      entries.set(key, entry);
      // Don't cache a rejected computation — evict so the next get retries.
      entry.value.catch(() => {
        if (entries.get(key) === entry) entries.delete(key);
      });
      return entry.value;
    },
    clear() {
      entries.clear();
    },
  };
}

/** Unique items by key, keeping the first occurrence and preserving order. */
export function distinct<T>(items: T[], key: (item: T) => string = (x) => String(x)): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Case-insensitive lookup from a set of canonical names. Returns a function that
 * maps any equivalently-cased input back to its canonical form, or undefined.
 * Guards against source duplicates whose only difference is casing — e.g. an
 * `SSP5-3.4-OS`/`SSP5-3.4-Os` run pair whose data is split across the two.
 */
export function caseInsensitiveLookup(canonical: string[]): (name: string) => string | undefined {
  const byLower = new Map<string, string>();
  for (const c of canonical) if (!byLower.has(c.toLowerCase())) byLower.set(c.toLowerCase(), c);
  return (name) => byLower.get(name.toLowerCase());
}

/**
 * Distinct strings, collapsing case-only duplicates to a single deterministic
 * canonical (the lexicographically smallest variant, so `SSP5-3.4-OS` wins over
 * `SSP5-3.4-Os`). Group order follows first appearance.
 */
export function distinctCaseInsensitive(names: string[]): string[] {
  // Group by lowercase (first appearance fixes group order); keep the
  // lexicographically smallest variant as the canonical for each group.
  const canonical = new Map<string, string>();
  for (const name of names) {
    const key = name.toLowerCase();
    const current = canonical.get(key);
    if (current === undefined || name < current) canonical.set(key, name);
  }
  return [...canonical.values()];
}
