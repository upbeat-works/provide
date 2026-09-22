// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Page from './page.ssr.fixture.svelte';
import { getScoreboard } from '../controller.js';

const { goto } = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('../components/ScoreboardMap.svelte', () => import('./map.test.fixture.svelte'));
vi.mock('$app/navigation', () => ({ goto, invalidate: vi.fn(), invalidateAll: vi.fn() }));
// The sidebar's index watches the article column, which needs an observer
// jsdom does not implement.
beforeEach(() => {
  goto.mockClear();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const option = (uid) => ({ uid, label: uid });
const scoreboard = getScoreboard('testing');
const definition = scoreboard.charts[0];
const readyChart = { definition, status: 'ready', data: [{ line: [{ year: 2050, value: 2 }] }] };
const common = {
  scoreboard,
  indicators: [option('Maximum Air Temperature'), option('Mean Air Temperature')],
  scenarios: [option('scenario')],
  regions: [option('Austria')],
  years: [option('2050')],
  selection: { indicator: option('Maximum Air Temperature'), scenario: option('scenario'), region: option('Austria'), year: option('2050') },
  map: { definition: scoreboard.indicator, status: 'ready', values: [{ region: 'AT11', value: 12 }] },
  charts: [],
};

test('writes the indicator parameter without changing the sector', async () => {
  render(Page, {
    data: common,
    url: new URL('http://localhost/projects/eu-scoreboard/indicators?sector=testing&indicator=Maximum%20Air%20Temperature'),
  });

  await fireEvent.click(screen.getByRole('button', { name: /^Indicator:/ }));
  await fireEvent.click(screen.getByRole('button', { name: 'Mean Air Temperature' }));

  const url = goto.mock.calls[0][0];
  expect(url.searchParams.get('sector')).toBe('testing');
  expect(url.searchParams.get('indicator')).toBe('Mean Air Temperature');
});

test.each([false, true])('changes sector and keeps the full indicator selection while comparison is %s', async (comparing) => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ...common.map, values: [] }));
  vi.stubGlobal('fetch', fetcher);
  render(Page, {
    data: { ...common, scenarios: [option('scenario'), option('other')] },
    url: new URL(
      'http://localhost/projects/eu-scoreboard/indicators?sector=testing&indicator=Maximum%20Air%20Temperature&region=Austria&scenario=scenario&year=2050'
    ),
  });
  if (comparing) {
    await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Scenario' }));
    await waitFor(() => expect(screen.getAllByRole('img', { name: 'Mock country map' })).toHaveLength(2));
  }

  await fireEvent.click(screen.getByRole('button', { name: /^Hazard\/Sector:/ }));
  await fireEvent.click(screen.getByRole('button', { name: 'Heat stress' }));

  const url = goto.mock.calls[0][0];
  expect(url.pathname).toBe('/projects/eu-scoreboard/indicators');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    sector: 'heat-stress',
    indicator: 'Maximum Air Temperature',
    region: 'Austria',
    scenario: 'scenario',
    year: '2050',
  });
});

test('keeps charts and country context available for a sector without a regional map', async () => {
  const chartsOnly = { ...scoreboard, map: { ...scoreboard.map, indicators: [] }, indicator: undefined };
  const chartSelection = { ...common.selection, indicator: undefined };
  render(Page, {
    data: {
      ...common,
      scoreboard: chartsOnly,
      indicators: [],
      selection: chartSelection,
      map: undefined,
      charts: [{ definition, result: readyChart }],
    },
    url: new URL('http://localhost/projects/eu-scoreboard/indicators?sector=testing&region=Austria&scenario=scenario&year=2050'),
  });

  expect(screen.getByRole('heading', { name: definition.title })).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Mock country map' }).dataset.country).toBe('Austria');
  expect(screen.getByText('Regional map data is not available for this sector.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Indicator:/ })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Compare' })).toBeNull();

  await fireEvent.click(screen.getByRole('button', { name: /^Hazard\/Sector:/ }));
  await fireEvent.click(screen.getByRole('button', { name: 'Heat stress' }));
  expect(Object.fromEntries(goto.mock.calls[0][0].searchParams)).toEqual({
    sector: 'heat-stress',
    region: 'Austria',
    scenario: 'scenario',
    year: '2050',
  });
});

test('renders a map and a ready chart while another chart is still loading', async () => {
  let finish;
  const slow = new Promise((resolve) => {
    finish = resolve;
  });
  render(Page, {
    data: {
      ...common,
      charts: [
        { definition, result: readyChart },
        { definition: scoreboard.charts[1], result: slow },
      ],
    },
  });
  expect(screen.getByRole('img', { name: 'Mock country map' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: definition.title })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain(scoreboard.charts[1].title);
  finish({ definition: scoreboard.charts[1], status: 'empty', data: [] });
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  expect(screen.queryByRole('heading', { name: scoreboard.charts[1].title })).toBeNull();
});

test('ignores an old map result after the selection changes', async () => {
  let finish;
  const slow = new Promise((resolve) => {
    finish = resolve;
  });
  const { rerender } = render(Page, { data: { ...common, map: slow } });
  await rerender({ data: { ...common, selection: { ...common.selection, year: option('2060') } } });
  const map = screen.getByRole('img', { name: 'Mock country map' });
  expect(JSON.parse(map.dataset.values)).toEqual(common.map.values);
  finish({ ...common.map, values: [{ uid: 'India (R9)', value: 99 }] });
  await Promise.resolve();
  expect(JSON.parse(map.dataset.values)).toEqual(common.map.values);
});

test('retries only the failed map and keeps a ready chart visible', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(common.map));
  vi.stubGlobal('fetch', fetcher);
  render(Page, { data: { ...common, map: { ...common.map, status: 'error', values: [], error: 'Map unavailable' }, charts: [{ definition, result: readyChart }] } });
  expect(screen.getByRole('heading', { name: definition.title })).toBeTruthy();
  await fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(fetcher).toHaveBeenCalledOnce();
  expect(Object.fromEntries(new URL(fetcher.mock.calls[0][0], 'https://example.test').searchParams)).toEqual({
    sector: 'testing',
    indicator: 'Maximum Air Temperature',
    region: 'Austria',
    scenario: 'scenario',
    year: '2050',
  });
  expect(screen.getByRole('heading', { name: definition.title })).toBeTruthy();
});

test('retries only the failed chart and leaves the map in place', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(readyChart));
  vi.stubGlobal('fetch', fetcher);
  render(Page, { data: { ...common, charts: [{ definition, result: { definition, status: 'error', error: 'Chart unavailable', data: [] } }] } });
  const map = screen.getByRole('img', { name: 'Mock country map' });
  await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(fetcher).toHaveBeenCalledOnce();
  const url = new URL(fetcher.mock.calls[0][0], 'https://example.test');
  expect(url.pathname).toBe(`/app/scoreboard/charts/${definition.chartId}`);
  expect(Object.fromEntries(url.searchParams)).toEqual({ sector: 'testing', region: 'Austria', scenario: 'scenario', year: '2050' });
  expect(screen.getByRole('img', { name: 'Mock country map' })).toBe(map);
});

test('compares a dimension side by side, taking it out of the filter bar', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ...common.map, values: [{ uid: 'India (R9)', label: 'India (R9)', value: 40 }] }));
  vi.stubGlobal('fetch', fetcher);
  render(Page, { data: { ...common, scenarios: [option('scenario'), option('other')] } });

  // One map, and one scenario picker — the filter bar's.
  expect(screen.getAllByRole('img', { name: 'Mock country map' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: /^Scenario:/ })).toHaveLength(1);

  await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Scenario' }));

  await waitFor(() => expect(screen.getAllByRole('img', { name: 'Mock country map' })).toHaveLength(2));
  // The compared dimension leaves the bar and reappears on each map: one picker
  // before, two after — the bar's is gone and each map has its own.
  expect(screen.getAllByRole('button', { name: /^Scenario:/ })).toHaveLength(2);
  // Geography and Year stay shared, in the bar, one each.
  expect(screen.getAllByRole('button', { name: /^Geography:/ })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: /^Year:/ })).toHaveLength(1);
  // The second side opened on a different scenario, so it asked for its own data.
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toContain('scenario=other');
});

test('colours both compared maps on one scale', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...common.map, values: [{ uid: 'India (R9)', label: 'India (R9)', value: 40 }] })));
  render(Page, { data: { ...common, scenarios: [option('scenario'), option('other')] } });
  await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Scenario' }));

  await waitFor(() => expect(screen.getAllByRole('img', { name: 'Mock country map' })).toHaveLength(2));
  // Two maps read against different ramps cannot be compared by eye, which is
  // the point of putting them side by side.
  const [left, right] = screen.getAllByRole('img', { name: 'Mock country map' });
  expect(left.dataset.classCount).toBe(right.dataset.classCount);
  expect(Number(left.dataset.classCount)).toBeGreaterThan(0);
});
