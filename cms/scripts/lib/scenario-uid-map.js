'use strict';
/**
 * Legacy CMS scenario UID -> the ixmp4 scenario name the catalog API serves.
 *
 * Pure — unit tested in scenario-uid-map.test.js.
 */

const IXMP4_UID_BY_LEGACY = {
  curpol: '2020 Climate Policies',
  'curpol-os': '2020 Climate Policies then back to 1.5 °C',
  'curpol-sap': '2020 Climate Policies then Stabilisation',
  gs: 'Delayed Climate Action',
  'gs-nzghg': 'Delayed Climate Action then Net Zero',
  sp: 'Shifting Pathway',
  'sp-nzghg': 'Shifting Pathway then Net Zero',
  modact: '2020 Climate Targets',
  'modact-os-1.5c': '2020 Climate Targets then back to 1.5 °C',
  'modact-os-1c': '2020 Climate Targets then back to 1 °C',
  'modact-sap': '2020 Climate Targets then Stabilisation',
  neg: 'High Negative Emissions',
  'neg-nzghg': 'High Negative Emissions then Net Zero',
  'neg-os-0': 'High Negative Emissions then back to 0 °C',
  'neg-sap': 'High Negative Emissions then Stabilisation',
  ren: 'High Renewables',
  'ren-nzco2': 'High Renewables then Net Zero CO2',
  ld: 'Low Demand',
  'ld-nzghg': 'Low Demand then Net Zero',
  ssp119: 'SSP1-1.9',
  'ssp119-extended': 'SSP1-1.9 (Extended)',
  'ssp534-over': 'SSP5-3.4-Overshoot',
  'ssp534-over-extended': 'SSP5-3.4-Overshoot (Extended)',
  'ref-1p5': 'Stabilisation at 1.5 °C',
  'ref-1p5-extended': 'Stabilisation at 1.5 °C (Extended)',
};

const RENAMED_CANONICAL = new Map([
  ['ssp5-3.4-os', 'SSP5-3.4-Overshoot'],
  ['stabilisation at 1.5°c', 'Stabilisation at 1.5 °C'],
]);

// ixmp4 names can differ only by case across runs; the adapter compares
// case-insensitively, so match that here.
const BY_LOWER = new Map(Object.entries(IXMP4_UID_BY_LEGACY).map(([k, v]) => [k.toLowerCase(), v]));
const TARGETS = new Set(Object.values(IXMP4_UID_BY_LEGACY));
const TARGET_BY_LOWER = new Map([...TARGETS].map((value) => [value.toLowerCase(), value]));

/** The ixmp4 name for a legacy uid, or null when ixmp4 has no counterpart. */
function ixmp4UidFor(legacyUid) {
  if (!legacyUid) return null;
  const key = String(legacyUid).toLowerCase();
  return BY_LOWER.get(key) ?? RENAMED_CANONICAL.get(key) ?? TARGET_BY_LOWER.get(key) ?? null;
}

/** Updates needed to bring Strapi rows onto the ixmp4 names. Idempotent. */
function planScenarioRekey(scenarios) {
  const plan = [];
  for (const row of scenarios ?? []) {
    const from = row?.UID;
    if (!from || TARGETS.has(from)) continue;
    const to = ixmp4UidFor(from);
    if (!to || to === from) continue;
    plan.push({ id: row.id, locale: row.locale, from, to });
  }
  return plan;
}

module.exports = { IXMP4_UID_BY_LEGACY, ixmp4UidFor, planScenarioRekey };
