// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, expect, test } from 'vitest';
import ChartPanel from './ChartPanel.svelte';
import { filterGroups } from './series-filter.js';
import { adaptChartResult } from './charts/adapter.js';

afterEach(cleanup);

const option = (uid) => ({ uid, label: uid });
const countries = ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece'];
const years = [2020, 2030, 2040];

const definition = {
  chartId: 'mean-air-temperature',
  title: 'Mean air temperature',
  description: 'Annual mean air temperature.',
  chartType: 'line',
  data: { groupBy: 'region', variables: ['Mean Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile'] },
};

const grouped = {
  definition,
  status: 'ready',
  series: [{ line: { variable: definition.data.variables[0], unit: '°C' } }],
  data: countries.map((name, index) => ({
    region: option(name),
    series: [{ line: years.map((year, step) => ({ year, value: index + step })) }],
  })),
};

const props = {
  definition,
  result: grouped,
  selection: { region: option('all'), scenario: option('CurrentPolicies'), year: option(2040) },
  sector: 'testing',
};

test('renders the chart alongside the picker for a grouped result', () => {
  render(ChartPanel, props);
  expect(screen.getByRole('heading', { name: 'Mean air temperature' })).toBeTruthy();
  expect(screen.getByText('1–10 of 12')).toBeTruthy();
  // The figure itself, not just the section around it.
  expect(document.querySelector('svg')).toBeTruthy();
});

// LayerCake draws nothing without layout, which jsdom has none of, and the
// legend that would otherwise name the series is suppressed while the picker is
// up. What reaches the figure is therefore asserted where it is decided — the
// filter feeding the adapter — rather than dug out of an empty chart.
test('passes only the selected countries to the chart', () => {
  const selected = ['Austria', 'France'];
  const adapted = adaptChartResult(filterGroups(grouped, selected), props.selection);
  expect(adapted.status).toBe('ready');
  expect(adapted.props.series.map(({ label }) => label)).toEqual(selected);
});

test('hides the legend while the picker is naming the series', () => {
  render(ChartPanel, props);
  expect(screen.getByRole('checkbox', { name: 'Austria' })).toBeTruthy();
  // ColorLegend titles one swatch per series; the picker already lists them.
  expect(document.querySelector('dl svg title')).toBeNull();
});

test('keeps the picker on screen when everything is cleared', async () => {
  render(ChartPanel, props);
  await fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(screen.getByText(/No countries selected/)).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'Austria' })).toBeTruthy();
});

test('shows an ungrouped chart with no picker at all', () => {
  const ungrouped = {
    definition: { ...definition, data: { variables: definition.data.variables } },
    status: 'ready',
    series: grouped.series,
    data: [{ line: years.map((year, step) => ({ year, value: step })) }],
  };
  render(ChartPanel, { ...props, result: ungrouped, selection: { ...props.selection, region: option('Austria') } });
  expect(screen.getByRole('heading', { name: 'Mean air temperature' })).toBeTruthy();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(document.querySelector('svg')).toBeTruthy();
  // No picker, so the legend is still the only thing naming the series.
  expect(document.querySelector('dl svg title')).toBeTruthy();
});

test('leaves a grouped bubble chart without a picker', () => {
  const bubble = {
    definition: { ...definition, chartType: 'bubble', data: { ...definition.data, variables: ['A|x', 'B|y', 'C|s'], x: 'A', y: 'B', size: 'C' } },
    status: 'ready',
    series: [{ x: { variable: 'A|x', unit: '°C' }, y: { variable: 'B|y', unit: '°C' }, size: { variable: 'C|s', unit: 'days' } }],
    data: countries.map((name, index) => ({ region: option(name), series: [{ x: index + 1, y: index + 2, size: index + 3 }] })),
  };
  render(ChartPanel, { ...props, definition: bubble.definition, result: bubble });
  expect(screen.getByRole('heading', { name: 'Mean air temperature' })).toBeTruthy();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByText(/of 12/)).toBeNull();
});
