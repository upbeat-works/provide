import { test, expect, describe } from 'vitest';
import { resolveScenarioSelection, isScenarioCombinationAvailable, parseStoredScenarios, graftScenarioAvailability } from './scenario-selection.js';

describe('resolveScenarioSelection', () => {
  const defaults = ['2020 Climate Policies'];

  test.each(['idle', 'loading', 'failure'])('leaves the selection untouched while availability is %s', (status) => {
    expect(
      resolveScenarioSelection({
        availability: { status },
        current: ['High Renewables'],
        defaults,
      })
    ).toBeNull();
  });

  test('keeps a confirmed valid selection unchanged', () => {
    expect(
      resolveScenarioSelection({
        availability: { status: 'success', data: [{ id: 'High Renewables' }] },
        current: ['High Renewables'],
        defaults,
      })
    ).toBeNull();
  });

  test('removes only scenarios excluded by a successful response', () => {
    expect(
      resolveScenarioSelection({
        availability: { status: 'success', data: [{ id: '2020 Climate Policies' }] },
        current: ['2020 Climate Policies', 'High Renewables'],
        defaults,
      })
    ).toEqual(['2020 Climate Policies']);
  });

  test('uses a default when success confirms the current selection is empty', () => {
    expect(
      resolveScenarioSelection({
        availability: {
          status: 'success',
          data: [{ id: '2020 Climate Policies' }, { id: 'SSP1-1.9' }],
        },
        current: ['High Renewables'],
        defaults,
      })
    ).toEqual(['2020 Climate Policies']);
  });

  test('uses the first allowed scenario when no default is allowed', () => {
    expect(
      resolveScenarioSelection({
        availability: { status: 'success', data: [{ id: 'SSP1-1.9' }, { id: 'Low Demand' }] },
        current: [],
        defaults,
      })
    ).toEqual(['SSP1-1.9']);
  });

  test('clears the selection when success confirms no scenarios are allowed', () => {
    expect(
      resolveScenarioSelection({
        availability: { status: 'success', data: [] },
        current: ['High Renewables'],
        defaults,
      })
    ).toEqual([]);
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
