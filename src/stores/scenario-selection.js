export function resolveScenarioSelection({ availability, current = [], defaults = [] }) {
  if (availability?.status !== 'success') return null;

  const selectable = (availability.data ?? []).map((scenario) => scenario.id ?? scenario);
  const confirmed = current.filter((id) => selectable.includes(id));
  if (confirmed.length) {
    const unchanged = confirmed.length === current.length && confirmed.every((id, index) => id === current[index]);
    return unchanged ? null : confirmed;
  }
  if (!selectable.length) return [];

  const preferred = defaults.filter((id) => selectable.includes(id));
  if (preferred.length) return preferred;
  return [selectable[0]];
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
 * `defaults` when the stored value is missing, blank, or invalid.
 */
export function parseStoredScenarios(raw, defaults, max) {
  if (typeof raw !== 'string' || raw.trim() === '') return defaults;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.sort().slice(0, max);
  } catch {}
  return defaults;
}

// Graft ixmp4 availability onto the catalog scenarios: `disabled` when the axis
// has no data, `endYear` refined by availability but FALLING BACK to the catalog
// timeframe. Blanking endYear would make the selector's `endYear === timeframe`
// filter drop unavailable scenarios from the list rather than grey them out.
export function graftScenarioAvailability(scenarios = [], availability = []) {
  const byUid = new Map((availability ?? []).map((a) => [String(a.uid).toLowerCase(), a]));
  return (scenarios ?? []).map((scenario) => {
    const found = byUid.get(String(scenario.uid).toLowerCase());
    return { ...scenario, endYear: found?.yearEnd ?? scenario.endYear, disabled: !found };
  });
}
