import { describe, expect, test } from 'vitest';
import { adaptChartResult, isChartVisible, paddedDomain, radiusForArea, sampledTicks, splitLineAtGaps } from './adapter.js';

const ref = (variable, unit = 'K') => ({ variable, model: 'Model', unit });
const faceted = (indicator) => `${indicator}|Absolute Values (No Change)|Annual|Area|50th Percentile`;
const result = (chartType, definitionData, data) => ({
  status: 'ready',
  series: definitionData,
  definition: { chartId: `example-${chartType}`, title: 'Example', description: 'Description', chartType, data: {} },
  data,
});

describe('chart result adapter', () => {
  test('keeps distinct stack series separate when their labels match', () => {
    const adapted = adaptChartResult(result('stacked_bar', [
      { segment: ref('Urban|Female', 'people') },
      { segment: ref('Rural|Female', 'people') },
    ], [{ segment: 2 }, { segment: 3 }]));

    expect(adapted.props.layers).toHaveLength(2);
    expect(adapted.props.layers[0].uid).not.toBe(adapted.props.layers[1].uid);
    expect(adapted.props.rows[0].values.map(({ value }) => value)).toEqual([2, 3]);
    expect(adapted.props.layers[0].color).not.toBe(adapted.props.layers[1].color);
  });

  test('keeps source shares and zero values unchanged', () => {
    const input = result('stacked_bar', [{ segment: ref('Young', '%') }, { segment: ref('Old', '%') }], [
      { region: { uid: 'A', label: 'A' }, series: [{ segment: 10 }, { segment: 30 }] },
      { region: { uid: 'B', label: 'B' }, series: [{ segment: 0 }, { segment: 0 }] },
    ]);
    input.definition.data = { ...input.definition.data, groupBy: 'region' };
    const adapted = adaptChartResult(input);

    expect(adapted.props.rows).toHaveLength(2);
    expect(adapted.props.rows[0].values).toMatchObject([{ value: 10, start: 0, end: 10 }, { value: 30, start: 10, end: 40 }]);
    expect(adapted.props.rows[1].values.map(({ value }) => value)).toEqual([0, 0]);
    expect(adapted.props.unit).toBe('%');
    expect(adapted.props.rows[0].total).toBe(40);
  });

  test('leaves a zero-total percentage bar blank beside a nonzero bar', () => {
    const input = result('stacked_bar', [{ segment: ref('Count', 'people') }], [
      { region: { uid: 'A', label: 'A' }, series: [{ segment: 0 }] },
      { region: { uid: 'B', label: 'B' }, series: [{ segment: 5 }] },
    ]);
    input.definition.data = { groupBy: 'region', stackMode: 'percent' };
    const adapted = adaptChartResult(input);
    expect(adapted.status).toBe('ready');
    expect(adapted.props.rows[0]).toMatchObject({ label: 'A', values: [] });
    expect(adapted.props.rows[1].values).toMatchObject([{ value: 100, start: 0, end: 100 }]);
  });

  test('plots scatter coordinates without requiring or displaying bubble size', () => {
    const input = result('scatter', [{ x: ref('Low', 'people'), y: ref('High', 'people') }], [
      { region: { uid: 'A', label: 'Region A' }, series: [{ x: 0, y: 20 }] },
      { region: { uid: 'B', label: 'Region B' }, series: [{ x: null, y: 30 }] },
    ]);
    input.definition.data.groupBy = 'region';
    const adapted = adaptChartResult(input);

    expect(adapted.status).toBe('ready');
    expect(adapted.kind).toBe('scatter');
    expect(adapted.props.points).toHaveLength(1);
    expect(adapted.props.points[0]).toMatchObject({ label: 'Region A', x: 0, y: 20 });
    expect(adapted.props.sizeLabel).toBeUndefined();
    expect(adapted.props.pointMode).toBe('scatter');
  });

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

  test('uses the selected year in line and snapshot charts', () => {
    const selection = { year: { uid: '2050', label: '2050' } };
    const line = result('line', [{ line: ref('Temperature') }], [{ line: [{ year: 2030, value: 1 }, { year: 2075, value: 2 }] }]);
    const bar = result('stacked_bar', [{ segment: ref('People', 'people') }], [{ segment: 2 }]);
    const scatter = result('scatter', [{ x: ref('Low'), y: ref('High') }], [{ x: 1, y: 2 }]);

    expect(adaptChartResult(line, selection).props.selectedYear).toBe(2050);
    expect(adaptChartResult(bar, selection).props.selectedYear).toBe(2050);
    expect(adaptChartResult(scatter, selection).props.selectedYear).toBe(2050);
  });

  test('shows one line per region and leaves out regions with no values', () => {
    const input = result('line', [{ line: ref('Vulnerability|Fatalities|Heat Waves|Return Period|1 Year', 'people') }], [
      { region: { uid: 'AT11', label: 'Mittelburgenland' }, series: [{ line: [{ year: 2030, value: 1 }, { year: 2050, value: 2 }] }] },
      { region: { uid: 'AT12', label: 'Nordburgenland' }, series: [{ line: [{ year: 2030, value: null }] }] },
      { region: { uid: 'AT13', label: 'Wien' }, series: [{ line: [{ year: 2030, value: 0 }] }] },
    ]);
    input.definition.data.groupBy = 'region';
    const adapted = adaptChartResult(input);

    expect(adapted.status).toBe('ready');
    expect(adapted.props.series).toEqual([
      expect.objectContaining({ uid: 'AT11-0', label: 'Mittelburgenland', values: [{ year: 2030, value: 1 }, { year: 2050, value: 2 }] }),
      expect.objectContaining({ uid: 'AT13-0', label: 'Wien', values: [{ year: 2030, value: 0 }] }),
    ]);
  });

  test('labels faceted line series by indicator', () => {
    const adapted = adaptChartResult(
      result(
        'line',
        [{ line: ref(faceted('Mean Air Temperature'), '°C') }, { line: ref(faceted('Maximum Air Temperature'), '°C') }],
        [{ line: [{ year: 2050, value: 18 }] }, { line: [{ year: 2050, value: 31 }] }]
      )
    );

    expect(adapted.props.series.map(({ label }) => label)).toEqual(['Mean Air Temperature', 'Maximum Air Temperature']);
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

  test('keeps available segments in incomplete regional stacks', () => {
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
    expect(adapted.props.rows.map(({ uid }) => uid)).toEqual(['AT', 'BE']);
    expect(adapted.props.rows[0].values).toMatchObject([{ label: 'B', value: 3 }]);
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

  test('omits a missing direct segment without hiding the available segment', () => {
    const adapted = adaptChartResult(result('stacked_bar', [{ segment: ref('A', 'people') }, { segment: ref('B', 'people') }], [{ segment: null }, { segment: 7 }]));
    expect(adapted.status).toBe('ready');
    expect(adapted.props.rows[0].values).toMatchObject([{ label: 'B', value: 7 }]);
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

  test('labels faceted bubble axes and size by indicator', () => {
    const adapted = adaptChartResult(
      result(
        'bubble',
        [
          {
            x: ref(faceted('Mean Air Temperature'), '°C'),
            y: ref(faceted('Maximum Air Temperature'), '°C'),
            size: ref(faceted('High Heat Risk Days'), 'days'),
          },
        ],
        [{ x: 18, y: 31, size: 42 }]
      )
    );

    expect(adapted.props).toMatchObject({
      xLabel: 'Mean Air Temperature (°C)',
      yLabel: 'Maximum Air Temperature (°C)',
      sizeLabel: 'High Heat Risk Days (days)',
      tooltipLabels: { x: 'Mean Air Temperature', y: 'Maximum Air Temperature', size: 'High Heat Risk Days' },
    });
  });

  test('uses trimmed display labels for bubble axes and tooltips with variable fallback', () => {
    const x = { ...ref('GDP|PPP', 'billion USD/yr'), label: '  GDP (PPP)  ' };
    const y = { ...ref('Population|Vulnerable|Heat', 'million'), label: 'Population vulnerable to heat' };
    const size = { ...ref('Population|Exposed', 'million'), label: '   ' };
    const adapted = adaptChartResult(result('bubble', [{ x, y, size }], [{ x: 100, y: 4, size: 500 }]));

    expect(adapted.props).toMatchObject({
      xLabel: 'GDP (PPP) (billion USD/yr)',
      yLabel: 'Population vulnerable to heat (million)',
      sizeLabel: 'Exposed (million)',
      tooltipLabels: { x: 'GDP (PPP)', y: 'Population vulnerable to heat', size: 'Exposed' },
    });
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
    const type = result('line_with_range', [{ line: ref('line'), rangeLow: ref('low'), rangeHigh: ref('high') }], []);
    type.definition.data.groupBy = 'scenario';
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
  const definition = { chartId: 'line', chartType: 'line', data: { variables: ['line'] } };
  expect(isChartVisible({ definition, status: 'empty', data: [] })).toBe(false);
  expect(isChartVisible({ definition, status: 'ready', data: [{ line: [{ year: 2050, value: null }] }] })).toBe(false);
  expect(isChartVisible({ definition, status: 'error', error: 'Failed', data: [] })).toBe(true);
});
