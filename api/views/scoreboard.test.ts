import { describe, expect, test } from 'vitest';
import { readDefaultRunSeries, readScoreboardMapSeries, selectScoreboardData } from './scoreboard';

const reference = { variable: 'Temperature|Mean', unit: 'K' };

function dataframe(rows: unknown[][]) {
  return { columns: ['scenario', 'region', 'model', 'unit', '2040', '2050'], values: rows };
}

describe('scoreboard default-run reader', () => {
  test('reads the source unit when the reference has no unit filter', async () => {
    let query;
    const platform = { iamc: { tabulate: async (request) => {
      query = request;
      return dataframe([['Scenario', 'Austria', 'Model', 'thousand people', null, 12]]);
    } } };

    const rows = await readDefaultRunSeries(platform, { variable: 'Population' }, { scenario: 'Scenario', regions: ['Austria'], year: 2050 });

    expect(query).not.toHaveProperty('unit');
    expect(rows[0]).toMatchObject({ unit: 'thousand people', '2050': 12 });
  });
  test('queries a configured map variable without model or unit filters', async () => {
    const calls: unknown[] = [];
    const platform = {
      iamc: {
        tabulate: async (query: unknown) => {
          calls.push(query);
          return dataframe([['CurrentPolicies', 'AT11', 'RIME-X v1.0.0', '°C', null, 0]]);
        },
      },
    };

    const rows = await readScoreboardMapSeries(
      platform,
      'Maximum Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile',
      { scenario: 'CurrentPolicies', regions: ['AT11'], year: 2050 }
    );

    expect(calls).toEqual([
      {
        variable: { name: 'Maximum Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile' },
        run: { defaultOnly: true },
        scenario: { name: 'CurrentPolicies' },
        region: { name_in: ['AT11'] },
        stepYear: 2050,
        wide: true,
      },
    ]);
    expect(rows[0]).toMatchObject({ region: 'AT11', model: 'RIME-X v1.0.0', unit: '°C', '2050': 0 });
  });

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

    const rows = await readDefaultRunSeries(platform, reference, { scenario: 'Current Policies', regions: ['Austria'], year: 2050 });

    expect(calls).toEqual([
      {
        variable: { name: 'Temperature|Mean' },
        unit: { name: 'K' },
        run: { defaultOnly: true },
        scenario: { name: 'Current Policies' },
        region: { name_in: ['Austria'] },
        stepYear: 2050,
        wide: true,
      },
    ]);
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
