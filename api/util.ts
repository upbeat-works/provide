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
