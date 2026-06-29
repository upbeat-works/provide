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
