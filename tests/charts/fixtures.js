export function lineContract() {
  return {
    data: {
      columns: ['year', 'scenario', 'value', 'lower', 'upper'],
      values: [
        [2030, 'SSP1', 1.2, 1, 1.4],
        [2035, 'SSP1', 1.4, 1.1, 1.7],
        [2030, 'SSP2', 1.8, 1.5, 2.2],
      ],
    },
    schema: {
      layout: 'cartesian',
      fields: [
        { name: 'year', label: 'Year', unit: 'year' },
        { name: 'scenario', label: 'Scenario' },
        { name: 'value', label: 'Value', unit: '%' },
        { name: 'lower', label: 'Lower', unit: '%' },
        { name: 'upper', label: 'Upper', unit: '%' },
      ],
      axes: [
        { channel: 'x', field: 'year', scale: 'linear' },
        { channel: 'y', field: 'value', scale: 'linear' },
      ],
      marks: [{ type: 'line', groups: ['scenario'], range: { lower: 'lower', upper: 'upper' } }],
    },
    meta: {
      info: [{ label: 'Model', value: 'MESMER' }],
      formats: ['csv'],
    },
  };
}

export function barContract() {
  const contract = lineContract();
  contract.data = {
    columns: ['geography', 'scenario', 'value'],
    values: [
      ['DEU', 'SSP1', 12.4],
      ['DEU', 'SSP2', 18.1],
      ['FRA', 'SSP1', -3.2],
    ],
  };
  contract.schema = {
    layout: 'cartesian',
    fields: [
      { name: 'geography', label: 'Geography' },
      { name: 'scenario', label: 'Scenario' },
      { name: 'value', label: 'Value', unit: '%' },
    ],
    axes: [
      { channel: 'x', field: 'geography', scale: 'band' },
      { channel: 'y', field: 'value', scale: 'linear' },
    ],
    marks: [{ type: 'bar', groups: ['scenario'] }],
  };
  return contract;
}

export function scatterContract() {
  const contract = lineContract();
  contract.data = {
    columns: ['geography', 'region', 'exposure', 'investment'],
    values: [
      ['DEU', 'Central', 10, 20],
      ['FRA', 'West', 12, 25],
      ['ESP', 'West', 15, null],
    ],
  };
  contract.schema = {
    layout: 'cartesian',
    fields: [
      { name: 'geography', label: 'Geography' },
      { name: 'region', label: 'Region' },
      { name: 'exposure', label: 'Exposure', unit: '%' },
      { name: 'investment', label: 'Investment', unit: '€' },
    ],
    axes: [
      { channel: 'x', field: 'exposure', scale: 'linear' },
      { channel: 'y', field: 'investment', scale: 'linear' },
    ],
    marks: [{ type: 'point', groups: ['region'], labels: ['geography'] }],
  };
  return contract;
}

export function tableContract() {
  const contract = barContract();
  contract.schema = {
    layout: 'table',
    fields: contract.schema.fields,
    columns: ['geography', 'scenario', 'value'],
    rowHeaders: ['geography'],
  };
  return contract;
}
