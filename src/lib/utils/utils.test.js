import { describe, test, expect } from 'bun:test';
import { extractEndYearFromScenarios, ciKeyBy, ciGet, ciEquals, withScenarioTimeframe } from './utils.js';

describe('withScenarioTimeframe', () => {
  test('grafts endYear from the selectable list, matched case-insensitively by uid', () => {
    const selected = [{ uid: 'SSP5-3.4-OS', label: 'x', color: '#000' }]; // no endYear
    const selectable = [{ uid: 'SSP5-3.4-Os', endYear: 2100 }]; // different casing, has endYear
    expect(withScenarioTimeframe(selected, selectable)).toEqual([
      { uid: 'SSP5-3.4-OS', label: 'x', color: '#000', endYear: 2100 },
    ]);
  });

  test('preserves an endYear already present on a selected scenario', () => {
    expect(withScenarioTimeframe([{ uid: 'gs', endYear: 2300 }], [{ uid: 'gs', endYear: 2100 }])).toEqual([
      { uid: 'gs', endYear: 2300 },
    ]);
  });

  test('leaves endYear undefined when the scenario is not selectable', () => {
    expect(withScenarioTimeframe([{ uid: 'orphan' }], [{ uid: 'gs', endYear: 2100 }])).toEqual([
      { uid: 'orphan', endYear: undefined },
    ]);
  });
});

describe('case-insensitive name matching', () => {
  test('ciKeyBy + ciGet resolve a differently-cased key (SSP5-3.4-OS/Os)', () => {
    const dict = ciKeyBy([{ uid: 'SSP5-3.4-Os', endYear: 2100 }]);
    expect(ciGet(dict, 'SSP5-3.4-OS')).toEqual({ uid: 'SSP5-3.4-Os', endYear: 2100 });
    expect(ciGet(dict, 'ssp5-3.4-os')).toEqual({ uid: 'SSP5-3.4-Os', endYear: 2100 });
    expect(ciGet(dict, 'Other')).toBeUndefined();
  });

  test('ciGet tolerates a null dict', () => {
    expect(ciGet(undefined, 'x')).toBeUndefined();
  });

  test('ciEquals compares case-insensitively', () => {
    expect(ciEquals('SSP5-3.4-OS', 'ssp5-3.4-os')).toBe(true);
    expect(ciEquals('2020 Climate Policies', '2020 climate policies')).toBe(true);
    expect(ciEquals('a', 'b')).toBe(false);
  });
});

describe('extractEndYearFromScenarios', () => {
  test('builds one timeframe per distinct end year, ignoring scenarios without one', () => {
    const available = [
      { uid: 'a', endYear: 2100 },
      { uid: 'b', endYear: 2100 },
      { uid: 'c', endYear: undefined }, // disabled / no data → no junk pill
    ];
    const selectable = [{ uid: 'a', endYear: 2100 }];
    expect(extractEndYearFromScenarios(available, selectable)).toEqual([
      { uid: 2100, label: 2100, disabled: false },
    ]);
  });
});
