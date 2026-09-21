import { describe, expect, test } from 'vitest';
import { adaptChartResult, isChartVisible, paddedDomain, radiusForArea, sampledTicks, splitLineAtGaps } from './adapter.js';

const ref = (variable, unit = 'K') => ({ variable, model: 'Model', unit });
const result = (chartType, definitionData, data) => ({
  status: 'ready',
  definition: { chartId: `example-${chartType}`, title: 'Example', description: 'Description', chartType, data: { series: definitionData } },
  data,
});

describe('chart result adapter', () => {
  test('keeps line gaps and joins range values by year', () => {
    const adapted = adaptChartResult(
      result(
        'line_with_range',
        [{ line: ref('Temperature|Mean'), rangeLow: ref('Temperature|Low'), rangeHigh: ref('Temperature|High') }],
        [
          {
            line: [
              { year: 2030, value: 2 },
              { year: 2050, value: null },
            ],
            rangeLow: [{ year: 2030, value: 1 }],
            rangeHigh: [{ year: 2030, value: 3 }],
          },
        ]
      )
    );
    expect(adapted.props.series[0].values).toEqual([
      { year: 2030, value: 2, min: 1, max: 3 },
      { year: 2050, value: null },
    ]);
    expect(adapted.props.yLabel).toBe('K');
    expect(adapted.info).toEqual(
      expect.arrayContaining([
        { label: 'Model', value: 'Model' },
        { label: 'Unit', value: 'K' },
      ])
    );
  });

  test('adapts a plain line without inventing range values', () => {
    const adapted = adaptChartResult(result('line', [{ line: ref('Temperature|Mean') }], [{ line: [{ year: 2030, value: 2 }] }]));
    expect(adapted.kind).toBe('line');
    expect(adapted.props.series[0].values).toEqual([{ year: 2030, value: 2 }]);
    expect(adapted.props.yDomain[0]).toBeLessThan(2);
    expect(adapted.props.yDomain[1]).toBeGreaterThan(2);
  });

  test('stacks direct segment values in config order without treating them as totals', () => {
    const adapted = adaptChartResult(result('stacked_bar', [{ segment: ref('Exposure|Children', 'people') }, { segment: ref('Exposure|Adults', 'people') }], [{ segment: 4 }, { segment: 7 }]), {
      region: { uid: 'EU', label: 'Europe' },
    });
    expect(adapted.props.rows).toEqual([
      { uid: 'EU', label: 'Europe', total: 11, values: [expect.objectContaining({ start: 0, end: 4, value: 4 }), expect.objectContaining({ start: 4, end: 11, value: 7 })] },
    ]);
    expect(adapted.props.layers.map(({ label }) => label)).toEqual(['Children', 'Adults']);
  });

  test('renders one direct-value stack per complete region for the selected year', () => {
    const grouped = result(
      'stacked_bar',
      [{ segment: ref('Exposure|Children', 'people') }, { segment: ref('Exposure|Adults', 'people') }],
      [
        { region: { uid: 'AT', label: 'Austria' }, series: [{ segment: 2 }, { segment: 3 }] },
        { region: { uid: 'BE', label: 'Belgium' }, series: [{ segment: 5 }, { segment: 7 }] },
      ]
    );
    grouped.definition.data.groupBy = 'region';
    const adapted = adaptChartResult(grouped, { year: { uid: '2050', label: '2050' } });
    expect(adapted.props.rows).toEqual([
      expect.objectContaining({ uid: 'AT', label: 'Austria', total: 5, values: [expect.objectContaining({ value: 2 }), expect.objectContaining({ value: 3 })] }),
      expect.objectContaining({ uid: 'BE', label: 'Belgium', total: 12, values: [expect.objectContaining({ value: 5 }), expect.objectContaining({ value: 7 })] }),
    ]);
  });

  test('excludes an incomplete regional stack without dropping complete regions', () => {
    const grouped = result(
      'stacked_bar',
      [{ segment: ref('A') }, { segment: ref('B') }],
      [
        { region: { uid: 'AT', label: 'Austria' }, series: [{ segment: null }, { segment: 3 }] },
        { region: { uid: 'BE', label: 'Belgium' }, series: [{ segment: 5 }, { segment: 7 }] },
      ]
    );
    grouped.definition.data.groupBy = 'region';
    const adapted = adaptChartResult(grouped);
    expect(adapted.props.rows.map(({ uid }) => uid)).toEqual(['BE']);
  });

  test('uses scenario labels for scenario-grouped stacks', () => {
    const grouped = result(
      'stacked_bar',
      [{ segment: ref('Value') }],
      [
        { scenario: { uid: 's1', label: 'Scenario one' }, series: [{ segment: 2 }] },
        { scenario: { uid: 's2', label: 'Scenario two' }, series: [{ segment: 4 }] },
      ]
    );
    grouped.definition.data.groupBy = 'scenario';
    expect(adaptChartResult(grouped).props.rows).toEqual([
      expect.objectContaining({ uid: 's1', label: 'Scenario one', total: 2 }),
      expect.objectContaining({ uid: 's2', label: 'Scenario two', total: 4 }),
    ]);
  });

  test('does not show a partial total when a direct segment is missing', () => {
    const adapted = adaptChartResult(result('stacked_bar', [{ segment: ref('A', 'people') }, { segment: ref('B', 'people') }], [{ segment: null }, { segment: 7 }]));
    expect(adapted.status).toBe('empty');
    expect(adapted.props).toBeUndefined();
  });

  test('rejects negative segments instead of clipping a misleading stack', () => {
    const adapted = adaptChartResult(result('stacked_bar', [{ segment: ref('Loss', 'people') }], [{ segment: -2 }]));
    expect(adapted).toMatchObject({ status: 'error', error: expect.stringContaining('negative') });
  });

  test('maps bubble roles and derives role labels and units', () => {
    const adapted = adaptChartResult(result('bubble', [{ x: ref('Risk|Score', 'index'), y: ref('Risk|Growth', '%'), size: ref('Population|Exposed', 'people') }], [{ x: 5, y: 2, size: 100 }]));
    expect(adapted.props.points).toEqual([expect.objectContaining({ x: 5, y: 2, size: 100 })]);
    expect(adapted.props.xLabel).toBe('Score (index)');
    expect(adapted.props.yLabel).toBe('Growth (%)');
    expect(adapted.props.sizeLabel).toBe('Exposed (people)');
  });

  test('renders complete regional bubbles with region labels and distinct values', () => {
    const grouped = result(
      'bubble',
      [{ x: ref('Risk|Score', 'index'), y: ref('Risk|Growth', '%'), size: ref('Population|Exposed', 'people') }],
      [
        { region: { uid: 'AT', label: 'Austria' }, series: [{ x: 1, y: 2, size: 3 }] },
        { region: { uid: 'BE', label: 'Belgium' }, series: [{ x: 4, y: null, size: 6 }] },
        { region: { uid: 'CZ', label: 'Czechia' }, series: [{ x: 7, y: 8, size: 9 }] },
      ]
    );
    grouped.definition.data.groupBy = 'region';
    const adapted = adaptChartResult(grouped);
    expect(adapted.props.points).toEqual([
      expect.objectContaining({ uid: 'AT-0', label: 'Austria', x: 1, y: 2, size: 3 }),
      expect.objectContaining({ uid: 'CZ-0', label: 'Czechia', x: 7, y: 8, size: 9 }),
    ]);
  });

  test('uses scenario labels for complete scenario-grouped bubbles', () => {
    const grouped = result(
      'bubble',
      [{ x: ref('x'), y: ref('y'), size: ref('size') }],
      [
        { scenario: { uid: 's1', label: 'Scenario one' }, series: [{ x: 1, y: 2, size: 3 }] },
        { scenario: { uid: 's2', label: 'Scenario two' }, series: [{ x: 4, y: null, size: 6 }] },
      ]
    );
    grouped.definition.data.groupBy = 'scenario';
    expect(adaptChartResult(grouped).props.points).toEqual([expect.objectContaining({ uid: 's1-0', label: 'Scenario one', x: 1, y: 2, size: 3 })]);
  });

  test('allows different bubble axes but rejects mixed units within one role', () => {
    const valid = result('bubble', [{ x: ref('First x', 'K'), y: ref('First y', '%'), size: ref('First size', 'people') }], [{ x: 1, y: 2, size: 3 }]);
    expect(adaptChartResult(valid).status).toBe('ready');
    const mixed = result(
      'bubble',
      [
        { x: ref('First x', 'K'), y: ref('First y', '%'), size: ref('First size', 'people') },
        { x: ref('Second x', '°C'), y: ref('Second y', '%'), size: ref('Second size', 'people') },
      ],
      [
        { x: 1, y: 2, size: 3 },
        { x: 2, y: 3, size: 4 },
      ]
    );
    expect(adaptChartResult(mixed)).toMatchObject({ status: 'error', error: expect.stringContaining('bubble role') });
  });

  test('returns empty for lines without a finite line and bubbles without a drawable point', () => {
    const line = result(
      'line_with_range',
      [{ line: ref('Mean'), rangeLow: ref('Low'), rangeHigh: ref('High') }],
      [{ line: [{ year: 2030, value: null }], rangeLow: [{ year: 2030, value: 1 }], rangeHigh: [{ year: 2030, value: 3 }] }]
    );
    expect(adaptChartResult(line).status).toBe('empty');
    const definitionData = [{ x: ref('x'), y: ref('y'), size: ref('size') }];
    expect(adaptChartResult(result('bubble', definitionData, [{ x: 1, y: null, size: 5 }])).status).toBe('empty');
    expect(adaptChartResult(result('bubble', definitionData, [{ x: 1, y: 2, size: 0 }])).status).toBe('empty');
  });

  test('passes empty and error states through without chart props', () => {
    expect(adaptChartResult({ ...result('line', [], []), status: 'empty' }).status).toBe('empty');
    expect(adaptChartResult({ ...result('line', [], []), status: 'error', error: 'Query failed' })).toMatchObject({ status: 'error', error: 'Query failed' });
  });

  test('rejects unsupported grouping values and chart types', () => {
    const value = result('bubble', [{ x: ref('x'), y: ref('y'), size: ref('size') }], []);
    value.definition.data.groupBy = 'model';
    expect(adaptChartResult(value)).toMatchObject({ status: 'error', error: expect.stringContaining('Unsupported chart grouping') });
    const type = result('line', [{ line: ref('line') }], []);
    type.definition.data.groupBy = 'region';
    expect(adaptChartResult(type)).toMatchObject({ status: 'error', error: expect.stringContaining('not supported') });
  });

  test('rejects mixed units on a shared axis', () => {
    const adapted = adaptChartResult(result('line', [{ line: ref('First', 'K') }, { line: ref('Second', '°C') }], [{ line: [] }, { line: [] }]));
    expect(adapted).toMatchObject({ status: 'error', error: expect.stringContaining('same unit') });
  });
});

test('bubble sizing represents value by area and equal values get usable domains', () => {
  expect(radiusForArea(100, 100)).toBeCloseTo(30);
  expect(radiusForArea(25, 100)).toBeCloseTo(15);
  const domain = paddedDomain([4, 4]);
  expect(domain[0]).toBeLessThan(4);
  expect(domain[1]).toBeGreaterThan(4);
});

test('line gaps become separate paths instead of zeroes or bridges', () => {
  const paths = splitLineAtGaps({
    uid: 'line',
    values: [
      { year: 2030, value: 1 },
      { year: 2040, value: null },
      { year: 2050, value: 3 },
    ],
  });
  expect(paths.map(({ values }) => values)).toEqual([[{ year: 2030, value: 1 }], [{ year: 2050, value: 3 }]]);
});

test('samples readable year ticks while retaining both ends', () => {
  const years = Array.from({ length: 86 }, (_, index) => 2015 + index);
  expect(sampledTicks(years)).toEqual([2015, 2032, 2049, 2066, 2083, 2100]);
});

test('chart visibility includes errors and excludes API and adapter-derived empty results', () => {
  const definition = { chartId: 'line', chartType: 'line', data: { series: [{ line: ref('line') }] } };
  expect(isChartVisible({ definition, status: 'empty', data: [] })).toBe(false);
  expect(isChartVisible({ definition, status: 'ready', data: [{ line: [{ year: 2050, value: null }] }] })).toBe(false);
  expect(isChartVisible({ definition, status: 'error', error: 'Failed', data: [] })).toBe(true);
});
