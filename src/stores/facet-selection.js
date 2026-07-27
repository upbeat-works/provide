/**
 * Pure helpers behind the advanced (tag) filters. The store in `state.js` owns
 * the fetching; everything decidable without I/O lives here so it is testable.
 */

/** Serialise the active selection into the `/catalog` query string. */
export function facetQuery(filters) {
  const params = new URLSearchParams();
  for (const [key, values] of Object.entries(filters)) {
    if (values?.length) params.set(key, values.join(','));
  }
  return params.toString();
}

/** Add or remove one value from a group, dropping the group when it empties. */
export function toggleFacetValue(filters, key, value) {
  const current = filters[key] ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  if (!next.length) return clearFacetGroup(filters, key);
  return { ...filters, [key]: next };
}

/** Remove a whole group from the selection. */
export function clearFacetGroup(filters, key) {
  const { [key]: _dropped, ...rest } = filters;
  return rest;
}

/** How many groups have at least one value selected. */
export function activeFacetGroupCount(filters) {
  return Object.values(filters).filter((values) => values?.length).length;
}
