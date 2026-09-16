// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import Page from './page.ssr.fixture.svelte';
import { getScoreboard } from '../controller.js';

vi.mock('../components/ScoreboardMap.svelte', () => import('../components/Map.test.fixture.svelte'));
const { invalidateAll } = vi.hoisted(() => ({ invalidateAll: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll }));

afterEach(() => {
  cleanup();
  invalidateAll.mockClear();
});

const option = (uid) => ({ uid, label: uid });
const common = {
  scenarios: [option('scenario')],
  regions: [option('region')],
  years: [option('2050')],
  selection: { scenario: option('scenario'), region: option('region'), year: option('2050') },
  map: {
    definition: { title: 'Heat-vulnerable population', geographyType: 'r9', data: { unit: 'million' } },
    status: 'ready',
    values: [{ uid: 'European Union (R9)', label: 'European Union (R9)', value: 12 }],
  },
};

test('an empty sector keeps the base map visible', () => {
  const map = { definition: getScoreboard('heat-stress').mapDefinition, status: 'empty', values: [] };
  render(Page, { data: { ...common, scoreboard: getScoreboard('heat-stress'), map, charts: [] } });
  expect(screen.getByRole('img', { name: 'Mock country map' })).toBeTruthy();
});

test('a chart error keeps the base map and reports the data error', () => {
  const definition = getScoreboard('testing').definitions[0];
  render(Page, {
    data: {
      ...common,
      scoreboard: getScoreboard('testing'),
      charts: [{ definition, status: 'error', data: [], error: 'Source unavailable' }],
    },
  });
  expect(screen.getByRole('img', { name: 'Mock country map' })).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('Source unavailable');
});

test('maps API values and clears the legend when a selection has no values', async () => {
  const data = { ...common, scoreboard: getScoreboard('testing'), charts: [] };
  const { component } = render(Page, { data });
  const map = screen.getByRole('img', { name: 'Mock country map' });
  expect(JSON.parse(map.dataset.values)).toEqual(common.map.values);
  expect(map.dataset.geographyType).toBe('r9');
  expect(screen.getByText('Heat-vulnerable population')).toBeTruthy();
  expect(screen.getByText(/million/)).toBeTruthy();

  const empty = { ...data, map: { ...data.map, status: 'empty', values: [] } };
  await component.$set({ data: empty });
  expect(JSON.parse(map.dataset.values)).toEqual([]);
  expect(screen.queryByText('Heat-vulnerable population')).toBeNull();
});

test('keeps the map visible and offers retry after a map error', async () => {
  const map = { ...common.map, status: 'error', values: [], error: 'Map unavailable' };
  const scoreboard = getScoreboard('testing');
  const charts = [{ definition: scoreboard.definitions[0], status: 'ready', data: [{ line: [{ year: 2050, value: 2 }] }] }];
  render(Page, { data: { ...common, scoreboard, map, charts } });
  expect(screen.getByRole('img', { name: 'Mock country map' })).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('Map unavailable');
  expect(screen.getByRole('heading', { name: scoreboard.definitions[0].title })).toBeTruthy();
  await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(invalidateAll).toHaveBeenCalledOnce();
});
