import { test, expect, describe } from 'bun:test';
import { resolveScenarioSelection, isScenarioCombinationAvailable, parseStoredScenarios, graftScenarioAvailability } from './scenario-selection.js';

describe('resolveScenarioSelection', () => {
  const defaults = ['2020 Climate Policies'];

  test('leaves selection untouched while availability is still loading', () => {
    expect(resolveScenarioSelection({ selectable: [], current: ['High Renewables'], defaults })).toBeNull();
  });

  test('keeps a valid selection unchanged', () => {
    expect(resolveScenarioSelection({ selectable: ['High Renewables', 'SSP1-1.9'], current: ['High Renewables'], defaults })).toBeNull();
  });

  test('does NOT swap a selection that has no data for this view', () => {
    // 'High Renewables' is selected but not available here — we must leave it
    // alone (surfaced as "no data here — pick another"), never swap it.
    expect(resolveScenarioSelection({ selectable: ['2020 Climate Policies', 'SSP1-1.9'], current: ['High Renewables'], defaults })).toBeNull();
  });

  test('does NOT prune an unavailable scenario out of a multi-selection', () => {
    expect(resolveScenarioSelection({ selectable: ['2020 Climate Policies'], current: ['2020 Climate Policies', 'High Renewables'], defaults })).toBeNull();
  });

  test('fills an empty selection with the default when it is available', () => {
    expect(resolveScenarioSelection({ selectable: ['2020 Climate Policies', 'SSP1-1.9'], current: [], defaults })).toEqual(['2020 Climate Policies']);
  });

  test('fills an empty selection with the first selectable when the default is unavailable', () => {
    expect(resolveScenarioSelection({ selectable: ['SSP1-1.9', 'Low Demand'], current: [], defaults })).toEqual(['SSP1-1.9']);
  });
});

describe('isScenarioCombinationAvailable', () => {
  test('optimistic while availability is still loading (no selectable known yet)', () => {
    // The key change: a selected scenario must NOT read as "unavailable" just
    // because the check hasn't landed. This is what removes the landing flicker.
    expect(isScenarioCombinationAvailable({ isAvoidPage: false, selectable: [], current: ['2020 Climate Policies'] })).toBe(true);
  });

  test('available once loaded and the selection is present', () => {
    expect(isScenarioCombinationAvailable({ isAvoidPage: false, selectable: ['2020 Climate Policies', 'SSP1-1.9'], current: ['2020 Climate Policies'] })).toBe(true);
  });

  test('unavailable once loaded and the selection is genuinely excluded', () => {
    expect(isScenarioCombinationAvailable({ isAvoidPage: false, selectable: ['2020 Climate Policies', 'SSP1-1.9'], current: ['High Renewables'] })).toBe(false);
  });

  test('empty selection is not available', () => {
    expect(isScenarioCombinationAvailable({ isAvoidPage: false, selectable: ['2020 Climate Policies'], current: [] })).toBe(false);
  });

  test('avoid page is always available', () => {
    expect(isScenarioCombinationAvailable({ isAvoidPage: true, selectable: [], current: [] })).toBe(true);
  });
});

describe('parseStoredScenarios', () => {
  const defaults = ['2020 Climate Policies'];

  test('restores a valid saved selection', () => {
    expect(parseStoredScenarios(JSON.stringify(['High Renewables']), defaults, 3)).toEqual(['High Renewables']);
  });

  test('falls back to defaults when missing/blank', () => {
    expect(parseStoredScenarios(null, defaults, 3)).toEqual(defaults);
    expect(parseStoredScenarios('', defaults, 3)).toEqual(defaults);
    expect(parseStoredScenarios('   ', defaults, 3)).toEqual(defaults);
  });

  test('falls back to defaults on invalid JSON', () => {
    expect(parseStoredScenarios('not json', defaults, 3)).toEqual(defaults);
  });

  test('caps at max scenarios', () => {
    expect(parseStoredScenarios(JSON.stringify(['a', 'b', 'c', 'd']), defaults, 3).length).toBe(3);
  });
});

describe('graftScenarioAvailability', () => {
  const catalog = [
    { uid: '2020 Climate Policies', endYear: 2100 },
    { uid: 'SSP5-3.4-OS', endYear: 2100 },
    { uid: 'Today', endYear: 2000 },
  ];

  test('marks scenarios the axis has no data for as disabled', () => {
    const out = graftScenarioAvailability(catalog, [{ uid: 'SSP5-3.4-OS', yearEnd: 2100 }]);
    expect(out.map((s) => s.disabled)).toEqual([true, false, true]);
  });

  test('keeps the catalog timeframe on scenarios with no availability', () => {
    // Blanking endYear here makes the selector's `endYear === currentTimeframe`
    // filter hide them entirely, instead of greying them out.
    const out = graftScenarioAvailability(catalog, [{ uid: 'SSP5-3.4-OS', yearEnd: 2100 }]);
    expect(out.map((s) => s.endYear)).toEqual([2100, 2100, 2000]);
  });

  test('availability refines the timeframe when it differs from the catalog', () => {
    const out = graftScenarioAvailability(catalog, [{ uid: '2020 Climate Policies', yearEnd: 2300 }]);
    expect(out[0].endYear).toBe(2300);
  });

  test('matches case-insensitively, for the case-only duplicate runs', () => {
    const out = graftScenarioAvailability(catalog, [{ uid: 'ssp5-3.4-os', yearEnd: 2100 }]);
    expect(out[1].disabled).toBe(false);
  });

  test('with no availability yet, everything keeps its catalog timeframe', () => {
    const out = graftScenarioAvailability(catalog, []);
    expect(out.map((s) => s.endYear)).toEqual([2100, 2100, 2000]);
    expect(out.every((s) => s.disabled)).toBe(true);
  });

  test('tolerates missing input', () => {
    expect(graftScenarioAvailability(undefined, undefined)).toEqual([]);
  });
});
