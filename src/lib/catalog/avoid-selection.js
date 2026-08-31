// Pure avoid-page selection helpers, alias-free for `bun test`. Legacy id space.

// Indicators available for the selected city: those whose legacy
// `availableGeographies` includes the city uid. With no city, all are available
// (matches the pre-decoupling `!geo` fallback).
export function avoidAvailableIndicators(indicators = [], cityUid) {
  if (!cityUid) return indicators;
  return indicators.filter((i) => (i.availableGeographies ?? []).includes(cityUid));
}

// All params an indicator has, with each param's options intersected down to the
// values the indicator allows. Used to default/send EVERY param value.
export function avoidAllIndicatorParameters(indicator, indicatorParameters = []) {
  const allowed = indicator?.parameters ?? {};
  return indicatorParameters
    .filter((p) => Array.isArray(allowed[p.uid]))
    .map((p) => ({ ...p, options: (p.options ?? []).filter((o) => allowed[p.uid].includes(o.uid)) }));
}

// The param dropdowns shown to the user: only those with a real choice (>1
// option). Single-option params are still defaulted/sent, just not rendered.
export function avoidIndicatorParameters(indicator, indicatorParameters = []) {
  return avoidAllIndicatorParameters(indicator, indicatorParameters).filter((p) => p.options.length > 1);
}

// Sector pills for the indicator picker: one per sector present in the given
// indicators, labelled from the legacy /meta sectors (uid fallback), with counts.
export function avoidSectors(indicators = [], sectorsMeta = []) {
  const labelByUid = new Map(sectorsMeta.map((s) => [s.uid, s.label]));
  const counts = new Map();
  for (const i of indicators) {
    const s = i.sector ?? 'other';
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts.entries()].map(([uid, count]) => ({ uid, label: labelByUid.get(uid) ?? uid, count }));
}

// The valid active sector pill: keep the current one while it exists, otherwise
// fall back to the first available (and pick a default when none is set). No-ops
// while there are no sectors yet.
export function reconcileSector(current, sectors = []) {
  if (!sectors.length) return current;
  return sectors.some((s) => s.uid === current) ? current : sectors[0].uid;
}

// The valid param values for an indicator: keep a previous value when it is still
// a legal option, otherwise fall back to the first option. Used to keep
// AVOID_PARAMS consistent whenever the indicator changes.
export function reconcileAvoidParams(params = [], previous = {}) {
  const next = {};
  for (const p of params) {
    const keep = previous[p.uid] && p.options.some((o) => o.uid === previous[p.uid]);
    next[p.uid] = keep ? previous[p.uid] : p.options[0]?.uid;
  }
  return next;
}
