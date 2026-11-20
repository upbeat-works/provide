import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import ImpactTime from './ImpactTime.svelte';

const baseline = { uid: 'baseline', label: 'Baseline', color: '#123456', colorInterpolator: () => '#345678' };
const alternative = { uid: 'alternative', label: 'Alternative', color: '#654321', colorInterpolator: () => '#654321' };

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

function renderProjection(scenarios, data, gmt = {}) {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({
    title: 'Projected heat',
    unit: 'days/yr',
    yearStart: 2030,
    yearStep: 10,
    data,
    gmt,
  })));
  return render(ImpactTime, {
    chartContext: {
      view: { status: 'ready' },
      geography: { uid: 'Austria' },
      indicator: { uid: 'Heat' },
      indicatorLabel: { label: 'Heat' },
      scenarios,
      static: true,
    },
  }).container;
}

test('leaves a gap in the line, band, and hover points when a year has no data', async () => {
  const container = renderProjection([baseline], {
    baseline: [[0, 12, 13], [null, null, null], [15, 16, 17], [18, 19, 20]],
  }, { baseline: [[1, 2, 3], [1, 2, 3], [1, 2, 3], [1, 2, 3]] });

  const line = await waitFor(() => {
    const path = container.querySelector('.path-line')?.getAttribute('d');
    expect(path).toBeTruthy();
    return path;
  });
  const band = container.querySelector('.path-area').getAttribute('d');
  expect(container.querySelector('.path-line').style.stroke).toBe('#345678');
  for (const path of [line, band]) {
    expect(path).not.toMatch(/NaN|undefined/);
    expect(path.match(/M/g)).toHaveLength(2);
    expect(path).toMatch(/M[^M]+L[^M]+$/);
  }
  const points = [...container.querySelectorAll('g:has(> circle[r="12"])')];
  expect(points).toHaveLength(9);
  const xPositions = points.map((point) => {
    const coordinates = point.parentElement.getAttribute('transform').match(/^translate\(([\d.]+), [\d.]+\)$/);
    expect(coordinates).toBeTruthy();
    return Number(coordinates[1]);
  });
  expect(xPositions[3] - xPositions[0]).toBeCloseTo(2 * (xPositions[6] - xPositions[3]));
  await fireEvent.mouseEnter(points[5]);
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip.textContent).toContain('16');
  expect(tooltip.textContent).toContain('2050');
  expect(tooltip.textContent).toContain('Baseline');
  expect(tooltip.textContent).toMatch(/\+2\.00\s*°C/);
});

test('keeps a known median when the lower or upper bound is missing', async () => {
  const container = renderProjection([baseline, alternative], {
    baseline: [[11, 12, 13], [null, 16, 17], [18, 19, null], [null, null, null]],
    alternative: [[6, 7, 8], [8, 9, 10], [10, 11, 12], [11, 12, 13]],
  });
  await waitFor(() => expect(container.querySelector('.path-line')?.getAttribute('d')).toBeTruthy());
  const points = [...container.querySelectorAll('g:has(> circle[r="12"])')];
  expect(points).toHaveLength(7);
  expect(container.querySelector('figure').innerHTML).not.toMatch(/translate\([^)]*(?:undefined|NaN)/);
  expect(container.querySelectorAll('svg rect')).toHaveLength(1);
  await fireEvent.mouseEnter(points[2]);
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip.textContent).toContain('19');
  expect(tooltip.textContent).toContain('2050');
});
