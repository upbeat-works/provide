import { describe, expect, test, vi } from 'vitest';
import { loadScoreboardChart, definitionGroupingError } from './charts';
import type { Definition } from './types';
import { adaptChartResult } from '../../src/routes/(default)/projects/eu-scoreboard/components/charts/adapter.js';

const selection = { scenario: 'Scenario A', region: 'Austria', year: 2050 };
const definition = (data = {}): Definition => ({ chartId: 'example', chartType: 'stacked_bar', data: { variables: ['Population'], unitFallback: 'people', ...data } });
const frame = (rows: unknown[][]) => ({ columns: ['variable', 'scenario', 'region', 'model', 'unit', '2050'], values: rows });
const source = (rows: unknown[][]) => ({ iamc: { tabulate: vi.fn().mockResolvedValue(frame(rows)) } });

describe('chart config usage', () => {
  test.each([undefined, 'percent'])('omits missing segments and keeps empty bars in place (%s)', async (stackMode) => {
    const values = { 'Stock|Small|New': 2, 'Stock|Small|Used': 3, 'Stock|Medium|New': null, 'Stock|Medium|Used': 4, 'Stock|Large|New': null, 'Stock|Large|Used': null };
    const platform = { iamc: { tabulate: vi.fn(async (query) => frame([
      [query.variable.name, 'Scenario A', 'Austria', 'Model', 'items', values[query.variable.name]],
    ])) } };
    const config = definition({ variables: Object.keys(values), bars: ['Small', 'Medium', 'Large'], stacks: ['New', 'Used'], stackMode });
    const result = await loadScoreboardChart(platform as never, {} as never, config, selection);
    const chart = adaptChartResult(result);
    expect(chart.status).toBe('ready');
    expect(chart.props.rows.map(({ label }) => label)).toEqual(['Small', 'Medium', 'Large']);
    expect(chart.props.rows.map(({ values }) => values.map(({ value }) => value))).toEqual(stackMode === 'percent' ? [[40, 60], [100], []] : [[2, 3], [4], []]);
    expect(chart.props.rows[1].values[0]).toMatchObject({ label: 'Used', start: 0, end: stackMode === 'percent' ? 100 : 4, color: chart.props.rows[0].values[1].color });
  });

  test.each([undefined, 'region', 'scenario'])('shows source percentages unchanged with missing segments (%s)', async (groupBy) => {
    const rows = [
      ['Stock|New', 'Scenario A', 'Austria', 'Model', '%', null],
      ['Stock|Used', 'Scenario A', 'Austria', 'Model', '%', 4],
      ['Stock|Repaired', 'Scenario A', 'Austria', 'Model', '%', 6],
    ];
    const platform = { iamc: { tabulate: vi.fn(async (query) => frame(rows.filter(([variable]) => variable === query.variable.name))) } };
    const config = definition({ variables: ['Stock|New', 'Stock|Used', 'Stock|Repaired'], stacks: ['New', 'Used', 'Repaired'], groupBy, regions: ['Austria'] });
    const result = await loadScoreboardChart(platform as never, {} as never, config, selection);
    const chart = adaptChartResult(result);
    expect(chart.status).toBe('ready');
    expect(chart.props.rows).toHaveLength(1);
    expect(chart.props.unit).toBe('%');
    expect(chart.props.rows[0].total).toBe(10);
    expect(chart.props.rows[0].values).toMatchObject([
      { label: 'Used', value: 4, start: 0, end: 4 },
      { label: 'Repaired', value: 6, start: 4, end: 10 },
    ]);
  });

  test.each([undefined, 'region', 'scenario'])('scales available segments to 100 percent (%s)', async (groupBy) => {
    const values = { 'Stock|New': null, 'Stock|Used': 4, 'Stock|Repaired': 6 };
    const platform = { iamc: { tabulate: vi.fn(async (query) => frame([
      [query.variable.name, 'Scenario A', 'Austria', 'Model', 'items', values[query.variable.name]],
    ])) } };
    const config = definition({ variables: Object.keys(values), stacks: ['New', 'Used', 'Repaired'], groupBy, regions: ['Austria'], stackMode: 'percent' });
    const result = await loadScoreboardChart(platform as never, {} as never, config, selection);
    const chart = adaptChartResult(result);
    expect(chart.status).toBe('ready');
    expect(chart.props.unit).toBe('%');
    expect(chart.props.rows[0].total).toBe(100);
    expect(chart.props.rows[0].values).toMatchObject([
      { label: 'Used', value: 40, start: 0, end: 40 },
      { label: 'Repaired', value: 60, start: 40, end: 100 },
    ]);
    expect(result.series[0].segment.unit).toBe('items');
  });

  test('reads the model from ixmp4 without a configured model or a model filter', async () => {
    const platform = source([['Population', 'Scenario A', 'Austria', 'Source model', 'people', 12]]);
    const config = { chartId: 'population', chartType: 'stacked_bar', data: { variables: ['Population'] } };
    const result = await loadScoreboardChart(platform as never, {} as never, config, selection);
    expect(platform.iamc.tabulate.mock.calls[0][0]).not.toHaveProperty('model');
    expect(result.series[0].segment.model).toBe('Source model');
    expect(adaptChartResult(result).info).toContainEqual({ label: 'Model', value: 'Source model' });
    expect(result.data).toEqual([{ segment: 12 }]);
  });

  test('rejects matching values from different models instead of choosing one', async () => {
    const platform = source([
      ['Population', 'Scenario A', 'Austria', 'Model A', 'people', 12],
      ['Population', 'Scenario A', 'Austria', 'Model B', 'people', 15],
    ]);
    const config = { chartId: 'population', chartType: 'stacked_bar', data: { variables: ['Population'] } };
    await expect(loadScoreboardChart(platform as never, {} as never, config, selection)).rejects.toThrow(/ambiguous/i);
  });
  test.each([
    ['line', {}, [{ line: [{ year: 2050, value: 2 }] }, { line: [{ year: 2050, value: 8 }] }]],
    ['scatter', { x: 'Low', y: 'High' }, [{ x: 2, y: 8 }]],
    ['bubble', { x: 'Low', y: 'High', size: 'Low' }, [{ x: 2, y: 8, size: 2 }]],
    ['line_with_range', { line: 'High', rangeLow: 'Low', rangeHigh: 'High' }, [{ line: [{ year: 2050, value: 8 }], rangeLow: [{ year: 2050, value: 2 }], rangeHigh: [{ year: 2050, value: 8 }] }]],
  ])('loads and renders %s using whole subsegments for roles', async (chartType, roles, expected) => {
    const platform = { iamc: { tabulate: vi.fn(async (query) => frame([
      [query.variable.name, 'Scenario A', 'Austria', 'Model', 'items', query.variable.name === 'Stock|Low' ? 2 : 8],
    ])) } };
    const config = { chartId: 'stock', chartType, data: { variables: ['Stock|Low', 'High|Stock|Annual'], ...roles } };
    const result = await loadScoreboardChart(platform as never, {} as never, config, selection);
    expect(result.data).toEqual(expected);
    expect(adaptChartResult(result).status).toBe('ready');
    expect(platform.iamc.tabulate.mock.calls.map(([query]) => query.variable.name).sort()).toEqual(['High|Stock|Annual', 'Stock|Low']);
  });

  test.each([
    [['Stock|Lowest', 'Stock|High'], 'Low'],
    [['Stock|Low', 'Other|Low', 'Stock|High'], 'Low'],
  ])('rejects missing or unclear role matches before querying', (variables, x) => {
    expect(definitionGroupingError({ chartId: 'stock', chartType: 'scatter', data: { variables, x, y: 'High' } })).toContain('exactly one variable');
  });
  test('queries full variable names and assigns values by whole subsegments in the configured order', async () => {
    const values = {
      'Inventory|Small|New': 2,
      'Inventory|Used|Large|Annual': 9,
      'Small|Used|Inventory': 3,
      'New|Inventory|Large': 6,
    };
    const config = {
      chartId: 'inventory', chartType: 'stacked_bar',
      data: { variables: Object.keys(values), bars: ['Large', 'Small'], stacks: ['Used', 'New'], unitFallback: 'items' },
    };
    const platform = { iamc: { tabulate: vi.fn(async (query) => frame([
      [query.variable.name, query.scenario.name, query.region.name_in[0], 'Model', 'thousand items', values[query.variable.name]],
    ])) } };
    const result = await loadScoreboardChart(platform as never, {} as never, config, selection);
    const chart = adaptChartResult(result);

    expect(chart.status).toBe('ready');
    expect(chart.props.rows.map(({ label, values }) => [label, values.map(({ label, value }) => [label, value])])).toEqual([
      ['Large', [['Used', 9], ['New', 6]]],
      ['Small', [['Used', 3], ['New', 2]]],
    ]);
    expect(chart.props.unit).toBe('thousand items');
    expect(chart.props.layers.map(({ label }) => label)).toEqual(['Used', 'New']);
    expect(chart.props.rows[0].values.map(({ color }) => color)).toEqual(chart.props.rows[1].values.map(({ color }) => color));
    expect(platform.iamc.tabulate.mock.calls.map(([query]) => query.variable.name)).toEqual(Object.keys(values));
    for (const [query] of platform.iamc.tabulate.mock.calls) {
      expect(query).toMatchObject({ scenario: { name: 'Scenario A' }, region: { name_in: ['Austria'] }, stepYear: 2050 });
    }
  });

  test.each([
    [['Stock|Smallest|New'], 'whole subsegments'],
    [['Stock|Small|New', 'Other|Small|New'], 'more than one variable'],
  ])('rejects a bar mapping with %s before reading source data', (variables, message) => {
    const error = definitionGroupingError({
      chartId: 'inventory', chartType: 'stacked_bar',
      data: { variables, bars: ['Small'], stacks: ['New'] },
    });
    expect(error).toContain(message);
  });
  test('orders regional stacks by their names and keeps each region separate', async () => {
    const platform = { iamc: { tabulate: vi.fn(async (query) => frame(
      ['A', 'B'].map((region, index) => [query.variable.name, 'Scenario A', region, 'Model', 'items', (index + 1) * (query.variable.name === 'Stock|Used' ? 3 : 2)])
    )) } };
    const config = definition({ variables: ['Stock|New', 'Stock|Used'], stacks: ['Used', 'New'], groupBy: 'region', regions: ['A', 'B'] });
    const result = await loadScoreboardChart(platform as never, {} as never, config, selection);
    const chart = adaptChartResult(result);
    expect(chart.props.rows.map(({ label, values }) => [label, values.map(({ label, value }) => [label, value])])).toEqual([
      ['A', [['Used', 3], ['New', 2]]],
      ['B', [['Used', 6], ['New', 4]]],
    ]);
  });

  test.each([['thousand people', 'thousand people'], [null, 'people']])('uses source unit %s or the configured fallback', async (unit, expected) => {
    const platform = source([['Population', 'Scenario A', 'Austria', 'Model', unit, 12]]);
    const config = definition();
    const result = await loadScoreboardChart(platform as never, {} as never, config, selection);

    expect(result.series[0].segment.unit).toBe(expected);
    expect(result.data).toEqual([{ segment: 12 }]);
    expect(config.data).not.toHaveProperty('unit');
    expect(result.definition).toEqual(config);
  });

  test('rejects units that differ between regions instead of mixing scales', async () => {
    const platform = source([
      ['Population', 'Scenario A', 'A', 'Model', 'people', 12],
      ['Population', 'Scenario A', 'B', 'Model', 'million', 2],
    ]);
    await expect(loadScoreboardChart(platform as never, {} as never, definition({ groupBy: 'region', regions: ['A', 'B'] }), selection)).rejects.toThrow(/unit/i);
  });

  test('updates bar values when the selected scenario changes', async () => {
    const platform = { iamc: { tabulate: vi.fn(async (query) => frame([
      ['Population', query.scenario.name, 'Austria', 'Model', 'people', query.scenario.name === 'Scenario A' ? 10 : 20],
    ])) } };
    const config = definition();
    const first = await loadScoreboardChart(platform as never, {} as never, config, selection);
    const second = await loadScoreboardChart(platform as never, {} as never, config, { ...selection, scenario: 'Scenario B' });

    expect(first).toMatchObject({ status: 'ready', data: [{ segment: 10 }] });
    expect(second).toMatchObject({ status: 'ready', data: [{ segment: 20 }] });
    expect(platform.iamc.tabulate.mock.calls.map(([query]) => query.scenario.name)).toEqual(['Scenario A', 'Scenario B']);
    for (const [query] of platform.iamc.tabulate.mock.calls) {
      expect(query).toMatchObject({ region: { name_in: ['Austria'] }, stepYear: 2050 });
    }
  });

  test('keeps regional bar values separate and omits regions without data', async () => {
    const platform = source([
      ['Population', 'Scenario A', 'AT11', 'Model', 'people', 2],
      ['Population', 'Scenario A', 'AT12', 'Model', 'people', 3],
    ]);
    const config = definition({ groupBy: 'region', regionLevel: 'NUTS2' });
    const result = await loadScoreboardChart(platform as never, {} as never, config, selection);

    expect(result.data).toHaveLength(2);
    expect(result.data).toEqual(expect.arrayContaining([
      { region: expect.objectContaining({ uid: 'AT11' }), series: [{ segment: 2 }] },
      { region: expect.objectContaining({ uid: 'AT12' }), series: [{ segment: 3 }] },
    ]));
    expect(platform.iamc.tabulate.mock.calls[0][0].region.name_in).not.toContain('Austria');
  });

  test('loads NUTS2 regions within the selected country for scatter points without a size variable', async () => {
    const platform = { iamc: { tabulate: vi.fn(async (query) => frame(
      query.region.name_in.map((region) => [query.variable.name, 'Scenario A', region, 'Model', 'people', 0])
    )) } };
    const config = { ...definition({ groupBy: 'region', regionLevel: 'NUTS2', variables: ['Low', 'High'], x: 'Low', y: 'High' }), chartType: 'scatter' };
    expect(definitionGroupingError(config)).toBeNull();
    const result = await loadScoreboardChart(platform as never, {} as never, config, selection);

    expect(result.status).toBe('ready');
    expect(result.data).toHaveLength(9);
    expect(result.data).toContainEqual({ region: { uid: 'AT13', label: 'Wien' }, series: [{ x: 0, y: 0 }] });
    for (const [query] of platform.iamc.tabulate.mock.calls) {
      expect(query.region.name_in).not.toContain('Austria');
      expect(query.region.name_in.every((region) => /^AT\d{2}$/.test(region))).toBe(true);
    }
  });

  test('loads a time series for each NUTS2 region in the selected country', async () => {
    const variable = 'Vulnerability|Fatalities|Heat Waves|Return Period|1 Year';
    const platform = { iamc: { tabulate: vi.fn(async (query) => ({
      columns: ['variable', 'scenario', 'region', 'model', 'unit', '2030', '2050'],
      values: query.region.name_in.slice(0, 2).map((region, index) => [variable, 'Scenario A', region, 'Vulnerability Model v1.0.0', 'people', index + 1, index + 2]),
    })) } };
    const config = { chartId: 'heat-fatalities', chartType: 'line', data: { groupBy: 'region', regionLevel: 'NUTS2', model: 'Vulnerability Model v1.0.0', variables: [variable] } };
    const result = await loadScoreboardChart(platform as never, {} as never, config, selection);

    expect(result.status).toBe('ready');
    expect(result.data).toEqual([
      { region: expect.objectContaining({ uid: 'AT12' }), series: [{ line: [{ year: 2030, value: 1 }, { year: 2050, value: 2 }] }] },
      { region: expect.objectContaining({ uid: 'AT13' }), series: [{ line: [{ year: 2030, value: 2 }, { year: 2050, value: 3 }] }] },
    ]);
    expect(platform.iamc.tabulate.mock.calls[0][0]).toMatchObject({ model: { name: 'Vulnerability Model v1.0.0' }, scenario: { name: 'Scenario A' } });
    expect(platform.iamc.tabulate.mock.calls[0][0]).not.toHaveProperty('stepYear');
  });
});
