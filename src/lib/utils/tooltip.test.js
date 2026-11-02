import { afterEach, expect, test, vi } from 'vitest';
import tippy from 'tippy.js';
import tooltip from './tooltip.js';

vi.mock('tippy.js', () => ({
  default: vi.fn(() => ({ enable: vi.fn(), disable: vi.fn(), destroy: vi.fn() })),
  roundArrow: '<svg></svg>',
}));
afterEach(() => { document.body.replaceChildren(); vi.clearAllMocks(); });

test('keeps chart tooltips inside the chart so page controls can cover them', () => {
  const chart = document.createElement('figure');
  chart.setAttribute('data-chart-tooltips', '');
  const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  chart.append(point);
  document.body.append(chart);
  tooltip(point, { content: '12 days/yr' });
  expect(tippy).toHaveBeenCalledWith(point, expect.objectContaining({ appendTo: chart, content: '12 days/yr' }));
});

test('keeps other tooltips attached to the page', () => {
  const button = document.createElement('button');
  document.body.append(button);
  tooltip(button, { content: 'Copy link' });
  expect(tippy).toHaveBeenCalledWith(button, expect.objectContaining({ appendTo: document.body }));
});
