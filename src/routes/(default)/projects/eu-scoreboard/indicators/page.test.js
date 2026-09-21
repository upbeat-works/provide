// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Page from './page.ssr.fixture.svelte';
import { getScoreboard } from '../controller.js';

vi.mock('../components/ScoreboardMap.svelte', () => import('../components/Map.test.fixture.svelte'));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidate: vi.fn(), invalidateAll: vi.fn() }));
// The sidebar's index watches the article column, which needs an observer
// jsdom does not implement.
beforeEach(() =>
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const option = (uid) => ({ uid, label: uid });
const scoreboard = getScoreboard('testing');
const definition = scoreboard.definitions[0];
const readyChart = { definition, status: 'ready', data: [{ line: [{ year: 2050, value: 2 }] }] };
const common = {
  scoreboard,
  scenarios: [option('scenario')],
  regions: [option('region')],
  years: [option('2050')],
  selection: { scenario: option('scenario'), region: option('region'), year: option('2050') },
  map: { definition: scoreboard.mapDefinition, status: 'ready', values: [{ uid: 'European Union (R9)', label: 'European Union (R9)', value: 12 }] },
  charts: [],
};

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
        { definition: scoreboard.definitions[1], result: slow },
      ],
    },
  });
  expect(screen.getByRole('img', { name: 'Mock country map' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: definition.title })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain(scoreboard.definitions[1].title);
  finish({ definition: scoreboard.definitions[1], status: 'empty', data: [] });
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  expect(screen.queryByRole('heading', { name: scoreboard.definitions[1].title })).toBeNull();
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
  expect(fetcher.mock.calls[0][0]).toBe('/app/scoreboard/map?sector=testing&scenario=scenario&region=region&year=2050');
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
  expect(fetcher.mock.calls[0][0]).toBe(`/app/scoreboard/charts/${definition.chartId}?sector=testing&scenario=scenario&region=region&year=2050`);
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
