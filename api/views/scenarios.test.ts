import { describe, test, expect } from 'bun:test';
import { scenarioAvailabilityFromRows } from './scenarios';

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
});
