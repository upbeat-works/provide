import { describe, test, expect } from 'bun:test';
import { extractEndYearFromScenarios } from './utils.js';

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
