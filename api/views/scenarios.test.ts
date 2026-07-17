import { describe, test, expect } from 'bun:test';
import { scenarioAvailabilityFromRows, pickRepresentativeWarmingLevel } from './scenarios';

describe('scenarioAvailabilityFromRows', () => {
  test('derives each scenario timeframe from its finite year columns', () => {
    const rows = [
      { scenario: 'A', model: 'M', '2020': 1, '2025': 2, '2030': 3 },
      // B's data stops at 2025 — a genuinely different timeframe.
      { scenario: 'B', model: 'M', '2020': 1, '2025': 2, '2030': null },
    ];
    expect(scenarioAvailabilityFromRows(rows)).toEqual([
      { uid: 'A', yearStart: 2020, yearStep: 5, yearEnd: 2030 },
      { uid: 'B', yearStart: 2020, yearStep: 5, yearEnd: 2025 },
    ]);
  });

  test('drops scenarios with no finite data and dedupes by scenario (first run wins)', () => {
    const rows = [
      { scenario: 'A', model: 'M1', '2020': 1, '2025': 2 },
      { scenario: 'A', model: 'M2', '2020': 9, '2025': 9 }, // duplicate scenario
      { scenario: 'Empty', model: 'M', '2020': null, '2025': null },
    ];
    expect(scenarioAvailabilityFromRows(rows).map((s) => s.uid)).toEqual(['A']);
  });

  test('dedupes scenarios case-insensitively (the SSP5-3.4-OS/Os source duplicate)', () => {
    const rows = [
      { scenario: 'SSP5-3.4-Os', model: 'M1', '2020': 1, '2025': 2 },
      { scenario: 'SSP5-3.4-OS', model: 'M2', '2020': 9, '2025': 9 }, // same scenario, other casing
    ];
    expect(scenarioAvailabilityFromRows(rows).map((s) => s.uid)).toEqual(['SSP5-3.4-Os']);
  });

  test('excludes named scenarios (the Today baseline) so they are not selectable', () => {
    const rows = [
      { scenario: '2020 Climate Policies', model: 'M', '2030': 0.3, '2100': 0.9 },
      { scenario: 'Today', model: 'M', '2000': 0.1 }, // baseline — never a selectable projection
    ];
    expect(scenarioAvailabilityFromRows(rows, { exclude: ['Today'] }).map((s) => s.uid)).toEqual([
      '2020 Climate Policies',
    ]);
  });

  test('exclusion matches case-insensitively', () => {
    const rows = [
      { scenario: 'today', model: 'M', '2000': 0.1 }, // lower-cased in this run
      { scenario: 'A', model: 'M', '2030': 0.3 },
    ];
    expect(scenarioAvailabilityFromRows(rows, { exclude: ['Today'] }).map((s) => s.uid)).toEqual(['A']);
  });
});

describe('pickRepresentativeWarmingLevel', () => {
  test('returns the middle of the ascending-sorted levels', () => {
    expect(pickRepresentativeWarmingLevel(['0.0 °C', '1.5 °C', '2.0 °C', '3.0 °C', '5.0 °C'])).toBe('2.0 °C');
    // Even count: the lower-middle, mirroring pickDefaultThreshold.
    expect(pickRepresentativeWarmingLevel(['1.5 °C', '2.0 °C'])).toBe('1.5 °C');
  });

  test('returns undefined when the indicator has no warming levels', () => {
    expect(pickRepresentativeWarmingLevel([])).toBeUndefined();
  });
});
