// Pure decision helpers for scenario selection + availability. No Svelte / no
// $-aliases so this is unit-testable with `bun test`.

/**
 * Decide the scenario selection when availability changes. Only fills a
 * genuinely empty selection; never swaps or prunes a selection the user already
 * has — a scenario with no data for the current view stays put and is surfaced
 * as "no data here — pick another" instead of silently changing (which showed
 * as a flash on slow, in-app navigations). Returns the uids to select, or null
 * to leave the current selection unchanged.
 */
export function resolveScenarioSelection({ selectable, current, defaults }) {
  if (!selectable || !selectable.length) return null; // availability not loaded yet
  if (current && current.length) return null; // keep whatever the user has
  const preferred = (defaults || []).filter((uid) => selectable.includes(uid));
  return preferred.length ? preferred : [selectable[0]];
}

/**
 * Whether the current scenario selection should be treated as "available" — used
 * to gate the charts and the "no data here" warning. Optimistic while the
 * availability check is still in flight (no selectable scenarios known yet) so
 * the selection shows and the charts render on landing instead of flashing
 * "unavailable". Once the check has landed (there ARE selectable scenarios),
 * require every selected scenario to be among them.
 */
export function isScenarioCombinationAvailable({ isAvoidPage, selectable, current }) {
  if (isAvoidPage) return true; // Avoid page needs no selected scenarios
  if (!Array.isArray(current) || !current.length) return false;
  if (!selectable.length) return true; // check not landed yet — stay optimistic
  return current.every((uid) => selectable.includes(uid));
}

/**
 * Parse the persisted scenario selection from localStorage. Falls back to
 * `defaults` when the stored value is missing, blank, or invalid. (Fixes a typo
 * — the guard tested `isString(value)` where `value` was the default array, so a
 * user's saved scenario was never actually restored.)
 */
export function parseStoredScenarios(raw, defaults, max) {
  if (typeof raw !== 'string' || raw.trim() === '') return defaults;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.sort().slice(0, max);
  } catch (e) {
    console.log('Error loading current scenarios from localstore:', e);
  }
  return defaults;
}
