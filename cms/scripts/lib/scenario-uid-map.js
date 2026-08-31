'use strict';
/**
 * Legacy CMS scenario UID -> the ixmp4 scenario name the catalog API serves.
 *
 * Partial by design: only the 10 scenarios ixmp4 serves today. The overshoot /
 * net-zero / extended variants stay legacy — re-keying them to a name nothing
 * returns just trades one broken join for another.
 *
 * Pure — unit tested in scenario-uid-map.test.js.
 */

const IXMP4_UID_BY_LEGACY = {
  curpol: '2020 Climate Policies',
  gs: 'Delayed Climate Action',
  sp: 'Shifting Pathway',
  modact: '2020 Climate Targets',
  neg: 'High Negative Emissions',
  ren: 'High Renewables',
  ld: 'Low Demand',
  ssp119: 'SSP1-1.9',
  'ssp534-over': 'SSP5-3.4-OS',
  'ref-1p5': 'Stabilisation At 1.5°C',
};

// ixmp4 names can differ only by case across runs; the adapter compares
// case-insensitively, so match that here.
const BY_LOWER = new Map(Object.entries(IXMP4_UID_BY_LEGACY).map(([k, v]) => [k.toLowerCase(), v]));
const TARGETS = new Set(Object.values(IXMP4_UID_BY_LEGACY).map((v) => v.toLowerCase()));

/** The ixmp4 name for a legacy uid, or null when ixmp4 has no counterpart. */
function ixmp4UidFor(legacyUid) {
  if (!legacyUid) return null;
  return BY_LOWER.get(String(legacyUid).toLowerCase()) ?? null;
}

/** Updates needed to bring Strapi rows onto the ixmp4 names. Idempotent. */
function planScenarioRekey(scenarios) {
  const plan = [];
  for (const row of scenarios ?? []) {
    const from = row?.UID;
    if (!from || TARGETS.has(String(from).toLowerCase())) continue;
    const to = ixmp4UidFor(from);
    if (!to || to === from) continue;
    plan.push({ id: row.id, locale: row.locale, from, to });
  }
  return plan;
}

module.exports = { IXMP4_UID_BY_LEGACY, ixmp4UidFor, planScenarioRekey };
