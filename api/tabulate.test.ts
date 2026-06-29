import { describe, test, expect } from 'bun:test';
import { dfToRows, yearColumns } from './tabulate';

describe('dfToRows', () => {
  test('zips column names onto each value row', () => {
    const df = {
      columns: ['scenario', 'model', '2020', '2025'],
      values: [
        ['A', 'M', 1, 2],
        ['B', 'M', 3, 4],
      ],
    };
    expect(dfToRows(df)).toEqual([
      { scenario: 'A', model: 'M', '2020': 1, '2025': 2 },
      { scenario: 'B', model: 'M', '2020': 3, '2025': 4 },
    ]);
  });

  test('returns [] for an empty frame', () => {
    expect(dfToRows({ columns: ['scenario'], values: [] })).toEqual([]);
  });
});

describe('yearColumns', () => {
  test('returns only 4-digit year keys, ascending, ignoring metadata columns', () => {
    expect(yearColumns({ scenario: 'A', model: 'M', '2030': 9, '2020': 1, '2025': 2 })).toEqual([2020, 2025, 2030]);
  });

  test('ignores non-4-digit numeric-ish keys', () => {
    expect(yearColumns({ scenario: 'A', '20255': 1, '202': 2, '2020': 3 })).toEqual([2020]);
  });
});
