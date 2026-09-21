import { describe, expect, test } from 'bun:test';
import { NotFound } from '@iiasa/ixmp4-ts';
import type { WideRow } from '../tabulate';
import { assembleEmissions, fetchEmissionsSeries } from './emissions';

describe('assembleEmissions', () => {
  test('keeps actual years, zero, negative values, and internal gaps while converting Mt to Gt', () => {
    const rows: WideRow[] = [
      {
        scenario: 'Pathway',
        model: 'FaIR',
        unit: 'Mt CO2-equiv/yr',
        '2040': 12_500,
        '2050': 0,
        '2075': null,
        '2100': -3_250,
      },
    ];

    expect(assembleEmissions(rows).get('pathway')).toEqual({
      scenario: 'Pathway',
      model: 'FaIR',
      unit: 'GtCO2eq/yr',
      data: [
        { year: 2040, value: 12.5 },
        { year: 2050, value: 0 },
        { year: 2075, value: null },
        { year: 2100, value: -3.25 },
      ],
      characteristics: { emissions2050: 0, emissions2100: -3.3 },
    });
  });

  test('does not convert a series that is already in Gt', () => {
    const rows: WideRow[] = [{ scenario: 'Gt pathway', unit: 'Gt CO2-equiv/yr', '2050': 24.25 }];

    expect(assembleEmissions(rows).get('gt pathway')?.data).toEqual([{ year: 2050, value: 24.25 }]);
  });

  test('omits a series with no values', () => {
    const rows: WideRow[] = [{ scenario: 'Empty', unit: 'Mt CO2-equiv/yr', '2050': null }];

    expect(assembleEmissions(rows)).toEqual(new Map());
  });

  test('rejects an unknown source unit', () => {
    const rows: WideRow[] = [{ scenario: 'Unknown', unit: 'kg CO2/yr', '2050': 10 }];

    expect(() => assembleEmissions(rows)).toThrow('Unsupported emissions unit: kg CO2/yr');
  });
});

describe('fetchEmissionsSeries', () => {
  test('queries the global Kyoto-gas series once and keeps source failures distinct from empty data', async () => {
    const queries: unknown[] = [];
    const platform = {
      iamc: {
        tabulate: async (query: unknown) => {
          queries.push(query);
          return {
            columns: ['scenario', 'unit', '2050'],
            values: [['Pathway', 'Mt CO2-equiv/yr', 20_000]],
          };
        },
      },
    };

    expect((await fetchEmissionsSeries(platform)).get('pathway')?.data).toEqual([{ year: 2050, value: 20 }]);
    expect(queries).toEqual([
      {
        region: { name: 'World' },
        variable: { name: 'Emissions|Kyoto Gases' },
        wide: true,
      },
    ]);

    const failure = new Error('source unavailable');
    await expect(fetchEmissionsSeries({ iamc: { tabulate: async () => Promise.reject(failure) } })).rejects.toBe(failure);
  });

  test('treats a missing source variable as no emissions', async () => {
    const missing = new NotFound({ message: 'variable missing' });
    const platform = { iamc: { tabulate: async () => Promise.reject(missing) } };

    expect(await fetchEmissionsSeries(platform)).toEqual(new Map());
  });
});
