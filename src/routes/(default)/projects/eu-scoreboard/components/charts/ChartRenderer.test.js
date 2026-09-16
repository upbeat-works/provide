// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import ChartRenderer from './ChartRenderer.svelte';

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
  const result = { definition: { chartId: `empty-${chartType}`, chartType, data: { series: [series] } }, status: 'empty', data: [] };
  const { container } = render(ChartRenderer, { result });
  expect(container.querySelector('figure')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});
