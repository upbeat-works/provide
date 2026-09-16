import { describe, expect, test } from 'vitest';
import { readDefaultRunSeries, selectScoreboardData } from './scoreboard';

const reference = { variable: 'Temperature|Mean', model: 'MESMER', unit: 'K' };

function dataframe(rows: unknown[][]) {
  return { columns: ['scenario', 'region', 'model', 'unit', '2040', '2050'], values: rows };
}

describe('scoreboard default-run reader', () => {
  test('queries an exact reference from default runs and returns plain rows', async () => {
    const calls: unknown[] = [];
    const platform = {
      iamc: {
        tabulate: async (query: unknown) => {
          calls.push(query);
          return dataframe([['Current Policies', 'Austria', 'MESMER', 'K', 1.2, 1.4]]);
        },
      },
    };

    const rows = await readDefaultRunSeries(platform, reference);

    expect(calls).toEqual([{
      variable: { name: 'Temperature|Mean' },
      model: { name: 'MESMER' },
      unit: { name: 'K' },
      run: { defaultOnly: true },
      wide: true,
    }]);
    expect(rows).toEqual([{ scenario: 'Current Policies', region: 'Austria', model: 'MESMER', unit: 'K', '2040': 1.2, '2050': 1.4 }]);
  });

  test('rejects duplicate rows for one scenario and region', () => {
    const rows = [
      { scenario: 'Current Policies', region: 'Austria', '2050': 1.4 },
      { scenario: 'Current Policies', region: 'Austria', '2050': 1.5 },
    ];
    expect(() => selectScoreboardData(rows, { scenario: 'Current Policies', region: 'Austria' })).toThrow('Ambiguous');
  });

  test('keeps missing yearly values missing', () => {
    const rows = [{ scenario: 'Current Policies', region: 'Austria', '2040': null, '2050': 1.4 }];
    expect(selectScoreboardData(rows, { scenario: 'Current Policies', region: 'Austria' })).toEqual([
      { year: 2040, value: null },
      { year: 2050, value: 1.4 },
    ]);
  });
});
