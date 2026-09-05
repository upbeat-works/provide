import { describe, expect, test } from 'bun:test';
import { ChartSchemaError, parseChartContract, parseDashboardConfig } from './contracts';

const definition = {
  id: 'scenario-pathways',
  title: 'Scenario pathways',
  description: 'Projected change by scenario.',
  type: 'line',
  dimensions: ['indicator', 'year', 'scenario'],
};

const lineContract = {
  data: {
    columns: ['step_year', 'scenario', 'value', 'lower', 'upper'],
    values: [
      [2030, 'SSP1', 1.2, 1, 1.4],
      [2035, 'SSP1', 1.4, 1.1, 1.7],
    ],
  },
  schema: {
    layout: 'cartesian',
    fields: [
      { name: 'step_year', label: 'Year', unit: 'year' },
      { name: 'scenario', label: 'Scenario' },
      { name: 'value', label: 'Crop yield', unit: '%' },
      { name: 'lower', label: 'Lower estimate', unit: '%' },
      { name: 'upper', label: 'Upper estimate', unit: '%' },
    ],
    axes: [
      { channel: 'x', field: 'step_year', scale: 'linear' },
      { channel: 'y', field: 'value', scale: 'linear' },
    ],
    marks: [
      {
        type: 'line',
        groups: ['scenario'],
        range: { lower: 'lower', upper: 'upper' },
      },
    ],
  },
  meta: {
    info: [{ label: 'Model', value: 'MESMER' }],
    formats: ['csv'],
  },
};

describe('parseDashboardConfig', () => {
  test('accepts a stakeholder chart array without data-source details', () => {
    expect(parseDashboardConfig([definition])).toEqual([definition]);
  });

  test('rejects duplicate chart ids and dimensions', () => {
    expect(() => parseDashboardConfig([definition, { ...definition }])).toThrow(ChartSchemaError);
    expect(() => parseDashboardConfig([{ ...definition, dimensions: ['year', 'year'] }])).toThrow(ChartSchemaError);
  });

  test('rejects unknown chart fields', () => {
    expect(() => parseDashboardConfig([{ ...definition, filters: ['scenario'] }])).toThrow(ChartSchemaError);
  });
});

describe('parseChartContract', () => {
  test('accepts a column table with an optional line range', () => {
    expect(parseChartContract(lineContract)).toEqual(lineContract);
  });

  test('rejects rows that do not match the column count', () => {
    const invalid = structuredClone(lineContract);
    invalid.data.values[0].pop();
    expect(() => parseChartContract(invalid)).toThrow(ChartSchemaError);
  });

  test('rejects schema fields that are absent from the data table', () => {
    const invalid = structuredClone(lineContract);
    invalid.schema.marks[0].range.lower = 'p05';
    expect(() => parseChartContract(invalid)).toThrow(ChartSchemaError);
  });

  test('rejects invalid line range values', () => {
    const textBound = structuredClone(lineContract);
    textBound.data.values[0][3] = 'low';
    expect(() => parseChartContract(textBound)).toThrow(ChartSchemaError);

    const reversedBounds = structuredClone(lineContract);
    reversedBounds.data.values[0][3] = 1.5;
    reversedBounds.data.values[0][4] = 1.4;
    expect(() => parseChartContract(reversedBounds)).toThrow(ChartSchemaError);
  });

  test('rejects a cartesian schema without one x and one y axis', () => {
    const invalid = structuredClone(lineContract);
    invalid.schema.axes[1].channel = 'x';
    expect(() => parseChartContract(invalid)).toThrow(ChartSchemaError);
  });
});
