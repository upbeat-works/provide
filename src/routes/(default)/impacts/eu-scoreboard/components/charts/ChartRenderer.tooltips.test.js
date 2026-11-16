import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Hono } from 'hono';
import { scoreboard } from '../../../../../../../api/routes/scoreboard';
import * as platform from '../../../../../../../api/platform';
import { load } from '$routes/(embed)/embed/[embed]/+page.server.js';
import Fixture from './ChartRenderer.test.fixture.svelte';

const api = new Hono({ strict: false }).route('/api/scoreboard', scoreboard);
const selections = { scenario: 'SSP1', region: 'Austria', year: '2050' };
const unit = '<img src=x onerror="window.chartReview=true"> & people';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test.each([
  ['scatter', { variables: ['Value|X', 'Value|Y'], x: 'X', y: 'Y' }, 'million'],
  ['bubble', { variables: ['Value|X', 'Value|Y', 'Value|Size'], x: 'X', y: 'Y', size: 'Size' }, 'million'],
  ['line', { variables: ['Value|Mean'] }, ''],
  ['line_with_range', { variables: ['Value|Mean', 'Value|Low', 'Value|High'], line: 'Mean', rangeLow: 'Low', rangeHigh: 'High' }, ''],
  ['stacked_bar', { variables: ['Value|Part A', 'Value|Part B'] }, ''],
  ['box_plot', { variables: ['Value|Mean', 'Value|Low', 'Value|High'], median: 'Mean', boxLow: 'Low', boxHigh: 'High' }, ''],
])('shows URL-supplied text safely in a %s tooltip', async (chartType, data, sourceUnit) => {
  const values = { X: 1, Y: 2, Size: 3, Mean: 2, Low: 1, High: 3, 'Part A': 1, 'Part B': 2 };
  const tabulate = vi.fn(async (query) => {
    const value = values[query.variable.name.split('|').at(-1)];
    return {
      columns: ['variable', 'scenario', 'region', 'model', 'unit', '2040', '2050'],
      values: [[query.variable.name, query.scenario.name, 'Austria', 'Model', sourceUnit, value, value]],
    };
  });
  vi.spyOn(platform, 'createPlatform').mockResolvedValue({ iamc: { tabulate } });
  const chart = {
    chartId: 'population', title: 'Population', description: '', chartType,
    data: { ...data, unitFallback: unit, groupBy: 'region', regions: ['Austria'] },
  };
  const url = new URL(`https://example.test/embed/eu-scoreboard-chart?${new URLSearchParams({ chart: JSON.stringify(chart), ...selections })}`);
  const fetch = (input, init) => {
    const target = new URL(input, url);
    return api.request(`${target.pathname}${target.search}`, init, { DB: {}, IXMP4_USERNAME: 'test', IXMP4_PASSWORD: 'test' });
  };
  const loaded = await load({ fetch, params: { embed: 'eu-scoreboard-chart' }, url });
  expect(loaded.scoreboardChart.status).toBe('ready');
  render(Fixture, { result: loaded.scoreboardChart, selection: loaded.selection });

  const point = await waitFor(() => within(screen.getByRole('figure')).getAllByLabelText(/Austria/)[0]);
  await fireEvent.mouseEnter(point);
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip.querySelector('img')).toBeNull();
  expect(tooltip.textContent).toContain(unit);
  expect(within(tooltip).getByText('Austria')).toBeTruthy();
  if (chartType === 'line_with_range') expect(within(tooltip).getByText('Range')).toBeTruthy();
  if (chartType === 'box_plot') expect(within(tooltip).getByText('Low – High')).toBeTruthy();
});

test.each([
  ['scatter', { variables: ['Value|X', 'Value|Y'], x: 'X', y: 'Y' }],
  ['bubble', { variables: ['Value|X', 'Value|Y', 'Value|Size'], x: 'X', y: 'Y', size: 'Size' }],
  ['line', { variables: ['Value|Mean'] }],
  ['line_with_range', { variables: ['Value|Mean', 'Value|Low', 'Value|High'], line: 'Mean', rangeLow: 'Low', rangeHigh: 'High' }],
  ['stacked_bar', { variables: ['Value|Part A', 'Value|Part B'] }],
  ['box_plot', { variables: ['Value|Mean', 'Value|Low', 'Value|High'], median: 'Mean', boxLow: 'Low', boxHigh: 'High' }],
])('formats %s tooltip values to the configured decimals', async (chartType, data) => {
  const values = { X: 1.25, Y: 2.5, Size: 3, Mean: 2.5, Low: 1.25, High: 3, 'Part A': 1.25, 'Part B': 2.5 };
  const tabulate = vi.fn(async (query) => {
    const value = values[query.variable.name.split('|').at(-1)];
    return {
      columns: ['variable', 'scenario', 'region', 'model', 'unit', '2040', '2050'],
      values: [[query.variable.name, query.scenario.name, 'Austria', 'Model', 'days/yr', value, value]],
    };
  });
  vi.spyOn(platform, 'createPlatform').mockResolvedValue({ iamc: { tabulate } });
  const chart = {
    chartId: 'decimals', title: 'Decimals', description: '', chartType, decimals: 3,
    data: { ...data, groupBy: 'region', regions: ['Austria'] },
  };
  const url = new URL(`https://example.test/embed/eu-scoreboard-chart?${new URLSearchParams({ chart: JSON.stringify(chart), ...selections })}`);
  const fetch = (input, init) => {
    const target = new URL(input, url);
    return api.request(`${target.pathname}${target.search}`, init, { DB: {}, IXMP4_USERNAME: 'test', IXMP4_PASSWORD: 'test' });
  };
  const loaded = await load({ fetch, params: { embed: 'eu-scoreboard-chart' }, url });
  render(Fixture, { result: loaded.scoreboardChart, selection: loaded.selection });

  const point = await waitFor(() => within(screen.getByRole('figure')).getAllByLabelText(/Austria/)[0]);
  await fireEvent.mouseEnter(point);
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip.textContent).toMatch(/\b(1\.250|2\.500)\b/);
});
