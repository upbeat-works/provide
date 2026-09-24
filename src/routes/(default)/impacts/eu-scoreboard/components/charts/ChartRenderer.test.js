// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import ChartRenderer from './ChartRenderer.svelte';
import ChartRendererFixture from './ChartRenderer.test.fixture.svelte';

const { invalidateAll } = vi.hoisted(() => ({ invalidateAll: vi.fn() }));
vi.mock('$app/navigation', () => ({ invalidateAll }));

afterEach(() => {
  cleanup();
  invalidateAll.mockClear();
});

test('retries a failed chart request', async () => {
  const result = {
    definition: { chartId: 'failed', chartType: 'line', data: [] },
    status: 'error',
    error: 'Chart data could not be loaded.',
    data: [],
  };
  render(ChartRenderer, { result });
  expect(screen.getByRole('alert').textContent).toContain('Chart data could not be loaded.');
  await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(invalidateAll).toHaveBeenCalledOnce();
});

test.each([
  ['line', { line: { variable: 'Temperature|Mean', model: 'Model', unit: 'K' } }],
  [
    'line_with_range',
    {
      line: { variable: 'Temperature|Mean', model: 'Model', unit: 'K' },
      rangeLow: { variable: 'Temperature|Low', model: 'Model', unit: 'K' },
      rangeHigh: { variable: 'Temperature|High', model: 'Model', unit: 'K' },
    },
  ],
  ['stacked_bar', { segment: { variable: 'Population|Exposed', model: 'Model', unit: 'people' } }],
  [
    'bubble',
    {
      x: { variable: 'Risk|Score', model: 'Model', unit: 'index' },
      y: { variable: 'Risk|Growth', model: 'Model', unit: '%' },
      size: { variable: 'Population|Exposed', model: 'Model', unit: 'people' },
    },
  ],
])('hides an empty %s chart without showing an error', (chartType, series) => {
  const result = { definition: { chartId: `empty-${chartType}`, chartType, data: {} }, status: 'empty', series: [series], data: [] };
  const { container } = render(ChartRenderer, { result });
  expect(container.querySelector('figure')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('shows the selected year on a line chart and a single-year bar chart', () => {
  const selection = { year: { uid: '2050', label: '2050' } };
  const line = {
    definition: { chartId: 'line', chartType: 'line', data: { variables: ['Temperature|Mean'] } },
    status: 'ready',
    series: [{ line: { variable: 'Temperature|Mean', model: 'Model', unit: 'K' } }],
    data: [{ line: [{ year: 2040, value: 1 }, { year: 2050, value: 2 }, { year: 2075, value: 3 }] }],
  };
  const bars = {
    definition: { chartId: 'bars', chartType: 'stacked_bar', data: { variables: ['Population|Age 65+'] } },
    status: 'ready',
    series: [{ segment: { variable: 'Population|Age 65+', model: 'Model', unit: 'people' } }],
    data: [{ segment: 100 }],
  };

  const lineView = render(ChartRendererFixture, { result: line, selection });
  expect(screen.getByRole('img', { name: 'Selected year 2050' })).toBeTruthy();
  lineView.unmount();

  render(ChartRendererFixture, { result: bars, selection });
  expect(screen.getByText('2050', { selector: 'span' })).toBeTruthy();
});
