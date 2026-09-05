import { describe, expect, test } from 'bun:test';
import { parseChartContract, type ChartContract } from './contracts';
import { buildChartModel, formatRecordValue, recordsFromTable } from './model';

const palette = ['blue', 'green', 'orange'];

function contract(overrides: Partial<ChartContract> = {}): ChartContract {
  return parseChartContract({
    data: {
      columns: ['year', 'scenario', 'geography', 'value', 'lower', 'upper', 'xValue', 'yValue'],
      values: [
        [2030, 'SSP1', 'DEU', 1.2, 1, 1.4, 10, 20],
        [2035, 'SSP1', 'DEU', 1.4, 1.1, 1.7, 11, 21],
        [2030, 'SSP2', 'FRA', 1.8, 1.5, 2.2, 12, 22],
      ],
    },
    schema: {
      layout: 'cartesian',
      fields: [
        { name: 'year', label: 'Year', unit: 'year' },
        { name: 'scenario', label: 'Scenario' },
        { name: 'geography', label: 'Geography' },
        { name: 'value', label: 'Value', unit: '%' },
        { name: 'lower', label: 'Lower', unit: '%' },
        { name: 'upper', label: 'Upper', unit: '%' },
        { name: 'xValue', label: 'Exposure', unit: '%' },
        { name: 'yValue', label: 'Investment', unit: '€' },
      ],
      axes: [
        { channel: 'x', field: 'year', scale: 'linear' },
        { channel: 'y', field: 'value', scale: 'linear' },
      ],
      marks: [{ type: 'line', groups: ['scenario'], range: { lower: 'lower', upper: 'upper' } }],
    },
    meta: { info: [], formats: ['csv'] },
    ...overrides,
  });
}

describe('recordsFromTable', () => {
  test('turns the column table into named records without changing order', () => {
    const rows = recordsFromTable(contract());
    expect(rows[0]).toMatchObject({ year: 2030, scenario: 'SSP1', value: 1.2 });
    expect(rows.map(({ scenario }) => scenario)).toEqual(['SSP1', 'SSP1', 'SSP2']);
  });
});

describe('buildChartModel', () => {
  test('groups lines by every requested field and includes their ranges in the domain', () => {
    const model = buildChartModel(contract(), palette);
    expect(model.layout).toBe('cartesian');
    if (model.layout !== 'cartesian') return;
    expect(model.marks[0].groups.map(({ label, color }) => ({ label, color }))).toEqual([
      { label: 'SSP1', color: 'blue' },
      { label: 'SSP2', color: 'green' },
    ]);
    expect(model.xDomain).toEqual([2030, 2035]);
    expect(model.yDomain).toEqual([1, 2.2]);
  });

  test('uses the ordered tuple when a mark has several group fields', () => {
    const value = contract();
    if (value.schema.layout !== 'cartesian') return;
    value.schema.marks = [{ type: 'line', groups: ['scenario', 'geography'] }];
    const model = buildChartModel(value, palette);
    if (model.layout !== 'cartesian') return;
    expect(model.marks[0].groups.map(({ label }) => label)).toEqual(['SSP1 · DEU', 'SSP2 · FRA']);
  });

  test('builds grouped bars and includes zero in their value domain', () => {
    const value = contract();
    value.schema = {
      layout: 'cartesian',
      fields: value.schema.fields,
      axes: [
        { channel: 'x', field: 'geography', scale: 'band' },
        { channel: 'y', field: 'value', scale: 'linear' },
      ],
      marks: [{ type: 'bar', groups: ['scenario'] }],
    };
    const model = buildChartModel(parseChartContract(value), palette);
    if (model.layout !== 'cartesian') return;
    expect(model.xDomain).toEqual(['DEU', 'FRA']);
    expect(model.yDomain).toEqual([0, 1.8]);
    expect(model.legend.map(({ label }) => label)).toEqual(['SSP1', 'SSP2']);
  });

  test('drops scatter rows missing either numeric axis value', () => {
    const value = contract();
    value.data.values[1][6] = 1_000_000;
    value.data.values[1][7] = null;
    value.schema = {
      layout: 'cartesian',
      fields: value.schema.fields,
      axes: [
        { channel: 'x', field: 'xValue', scale: 'linear' },
        { channel: 'y', field: 'yValue', scale: 'linear' },
      ],
      marks: [{ type: 'point', groups: ['scenario'], labels: ['geography'] }],
    };
    const model = buildChartModel(parseChartContract(value), palette);
    if (model.layout !== 'cartesian') return;
    expect(model.marks[0].groups.flatMap(({ records }) => records)).toHaveLength(2);
    expect(model.xDomain).toEqual([10, 12]);
    expect(model.yDomain).toEqual([20, 22]);
  });

  test('keeps table row order and contract column order', () => {
    const value = contract();
    value.schema = {
      layout: 'table',
      fields: value.schema.fields,
      columns: ['geography', 'scenario', 'value'],
      rowHeaders: ['geography'],
    };
    const model = buildChartModel(parseChartContract(value), palette);
    expect(model.layout).toBe('table');
    if (model.layout !== 'table') return;
    expect(model.schema.columns).toEqual(['geography', 'scenario', 'value']);
    expect(model.records.map(({ geography }) => geography)).toEqual(['DEU', 'DEU', 'FRA']);
  });
});

describe('formatRecordValue', () => {
  test('uses the shared formatter and shows missing values as an em dash', () => {
    expect(formatRecordValue({ value: 12.4 }, { name: 'value', label: 'Value', unit: '°C' })).toBe('12 °C');
    expect(formatRecordValue({ value: null }, { name: 'value', label: 'Value' })).toBe('—');
  });
});
