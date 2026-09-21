// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Page from './page.test.fixture.svelte';
import { getScoreboard } from './controller.js';

const { goto, invalidate } = vi.hoisted(() => ({ goto: vi.fn(), invalidate: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto, invalidate }));
vi.mock('./components/ScoreboardMap.svelte', () => import('./components/Map.test.fixture.svelte'));

beforeEach(() => {
  goto.mockClear();
  invalidate.mockClear();
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

const option = (uid, label = uid) => ({ uid, label });
const dataFor = (status = 'empty') => {
  const data = {
    scoreboard: getScoreboard(status === 'empty' ? 'heat-stress' : 'testing'),
    scenarios: [option('CurrentPolicies')],
    regions: [option('AT11', 'Eastern Austria')],
    years: [option('2050')],
    selection: { scenario: option('CurrentPolicies'), region: option('AT11'), year: option('2050') },
    charts: [],
  };
  if (status === 'empty') return data;
  if (status === 'adapter-empty') {
    data.charts = [{ definition: getScoreboard('testing').definitions[0], status: 'ready', data: [{ line: [{ year: 2050, value: null }] }] }];
    return data;
  }
  data.charts = [{ definition: getScoreboard('testing').definitions[0], status, data: [], error: 'failed' }];
  return data;
};

test('lists the configured indicators without loading their values', () => {
  const data = dataFor('empty');
  data.scoreboard = getScoreboard('testing');
  render(Page, { data });
  for (const definition of data.scoreboard.definitions) {
    expect(screen.getByRole('link', { name: definition.title })).toBeTruthy();
  }
});

// The filter bar is popover pickers, not native selects: open the field, then
// choose from the list it shows.
const openFilter = (field) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${field}:`) }));
const filterButton = (field) => screen.queryByRole('button', { name: new RegExp(`^${field}:`) });
const chooseOption = (label) => fireEvent.click(screen.getByRole('button', { name: label }));

const rankingRows = () => [...screen.getByRole('heading', { name: 'EU Scoreboard' }).closest('div').parentElement.querySelectorAll('ol li')];

test('shows a five-country mock ranking from the same values as the map', () => {
  render(Page, { data: dataFor('empty') });
  const map = screen.getByRole('img', { name: 'Mock country map' });
  const values = JSON.parse(map.dataset.values);
  expect(Number(map.dataset.classCount)).toBeGreaterThan(0);
  const rows = rankingRows();
  expect(rows).toHaveLength(5);
  for (const row of rows) {
    const link = row.querySelector('a');
    const value = values.find(({ label }) => label === link.textContent);
    expect(value).toBeTruthy();
    expect(row.textContent).toContain(String(value.value));
    const url = new URL(link.href);
    expect(url.searchParams.get('region')).toBe(value.label);
    expect(url.searchParams.get('sector')).toBe('heat-stress');
    expect(url.searchParams.get('scenario')).toBe('CurrentPolicies');
    expect(url.searchParams.get('year')).toBe('2050');
  }
});

test('pages through the whole ranking from the arrows at its foot', async () => {
  render(Page, { data: dataFor('empty') });
  const first = rankingRows().map((row) => row.querySelector('a').textContent);
  expect(first).toHaveLength(5);
  const previous = screen.getByRole('button', { name: 'Previous countries' });
  const next = screen.getByRole('button', { name: 'Next countries' });
  // Nowhere to go back to on the first page.
  expect(previous.disabled).toBe(true);
  expect(next.disabled).toBe(false);

  await fireEvent.click(next);
  const second = rankingRows().map((row) => row.querySelector('a').textContent);
  expect(second).not.toEqual(first);
  expect(second.some((label) => first.includes(label))).toBe(false);
  expect(previous.disabled).toBe(false);
  // Ranks keep counting from where the first page left off.
  expect(rankingRows()[0].textContent).toContain('6');

  await fireEvent.click(previous);
  expect(rankingRows().map((row) => row.querySelector('a').textContent)).toEqual(first);
});

test('stops at the end of the ranking rather than paging past it', async () => {
  render(Page, { data: dataFor('empty') });
  const next = screen.getByRole('button', { name: 'Next countries' });
  for (let i = 0; i < 20 && !next.disabled; i++) await fireEvent.click(next);
  expect(next.disabled).toBe(true);
  expect(rankingRows().length).toBeGreaterThan(0);
  expect(rankingRows().length).toBeLessThanOrEqual(5);
});

test('reverses the ranking from the sort control, keeping each country its rank', async () => {
  render(Page, { data: dataFor('empty') });
  const sort = screen.getByRole('button', { name: 'Highest risk countries' });
  const highest = rankingRows().map((row) => row.querySelector('a').textContent);
  const topRank = rankingRows()[0].textContent.trim().split(/\s+/)[0];

  await fireEvent.click(sort);
  expect(screen.getByRole('button', { name: 'Lowest ranked countries' })).toBeTruthy();
  const lowest = rankingRows().map((row) => row.querySelector('a').textContent);
  expect(lowest).not.toEqual(highest);
  // The other end of the same order, so the ranks are the ranking's last ones.
  expect(rankingRows()[0].textContent.trim().split(/\s+/)[0]).not.toBe(topRank);
  // And it starts at that end's top rather than part-way down.
  expect(screen.getByRole('button', { name: 'Previous countries' }).disabled).toBe(true);

  await fireEvent.click(screen.getByRole('button', { name: 'Lowest ranked countries' }));
  expect(rankingRows().map((row) => row.querySelector('a').textContent)).toEqual(highest);
});

test('leaves the ranking card clickable under the full-width button laid over the map', () => {
  render(Page, { data: dataFor('empty') });
  // The strip that centres "How to read this scoreboard" spans the map, and sits
  // over the card's controls; only the button itself may take clicks.
  const strip = screen.getByRole('link', { name: /How to read this scoreboard/ }).parentElement;
  expect(strip.className).toContain('pointer-events-none');
  expect(screen.getByRole('link', { name: /How to read this scoreboard/ }).className).toContain('pointer-events-auto');
});

test('selection changes keep the sector and request new API-backed data', async () => {
  render(Page, { data: dataFor('empty'), url: new URL('http://localhost/projects/eu-scoreboard?sector=heat-stress') });
  await openFilter('Scenario');
  await chooseOption('CurrentPolicies');
  const url = goto.mock.calls[0][0];
  expect(url.searchParams.get('sector')).toBe('heat-stress');
  expect(url.searchParams.get('scenario')).toBe('CurrentPolicies');
});

test('indicator links carry the resolved selection', () => {
  render(Page, { data: dataFor('empty') });
  const link = screen.getByRole('link', { name: /Explore Heat stress indicators/ });
  const url = new URL(link.href);
  expect(url.searchParams.get('sector')).toBe('heat-stress');
  expect(url.searchParams.get('region')).toBe('AT11');
  expect(url.searchParams.get('year')).toBe('2050');
});

test.each(['Indicators', /Explore Heat stress indicators/])('links follow changed filters: %s', async (name) => {
  const data = dataFor('empty');
  const { rerender } = render(Page, { data });
  await rerender({
    data: { ...data, years: [option('2060')], selection: { ...data.selection, year: option('2060') } },
    url: new URL('http://localhost/projects/eu-scoreboard?sector=heat-stress&scenario=CurrentPolicies&region=AT11&year=2060'),
  });
  expect(new URL(screen.getByRole('link', { name }).href).searchParams.get('year')).toBe('2060');
});

test('the overview index links to each explanatory section', () => {
  const { container } = render(Page, { data: dataFor('empty') });
  const index = screen.getByText('Index').closest('nav');
  const links = [...index.querySelectorAll('a')];

  expect(links).toHaveLength(4);
  for (const link of links) {
    const target = new URL(link.href).hash.slice(1);
    expect(container.querySelector(`#${target}`)).toBeTruthy();
  }
});

test('view tabs carry the resolved selection', () => {
  render(Page, { data: dataFor('error') });
  const indicators = screen.getByRole('link', { name: 'Indicators' });
  const url = new URL(indicators.href);
  expect(url.searchParams.get('scenario')).toBe('CurrentPolicies');
  expect(url.searchParams.get('region')).toBe('AT11');
  expect(url.searchParams.get('year')).toBe('2050');
});

test('sector choices come from server-loaded scoreboard data', async () => {
  const data = dataFor('empty');
  data.scoreboard = {
    ...data.scoreboard,
    sector: { uid: 'custom', label: 'Custom' },
    sectors: [{ uid: 'custom', label: 'Custom' }],
  };
  render(Page, { data });
  expect(filterButton('Hazard/Sector').textContent).toContain('Custom');
  await openFilter('Hazard/Sector');
  expect(screen.getAllByRole('button', { name: 'Custom' })).toHaveLength(1);
});

test('keeps the selected year visible and other choices usable after a year lookup failure', async () => {
  const data = dataFor();
  data.selection.year = option('2070');
  data.scoreboardOptions = { status: 'ready', yearStatus: 'error', yearError: 'Years could not be loaded.' };
  render(Page, { data });
  // The year the options no longer cover still names itself rather than being
  // silently swapped for another.
  expect(filterButton('Year').textContent).toContain('2070');
  expect(filterButton('Scenario')).toBeTruthy();
  // The ranking view always draws the whole of Europe, so it offers no region.
  expect(filterButton('Region')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('Years could not be loaded.');
  await fireEvent.click(screen.getByRole('button', { name: 'Retry choices' }));
  expect(invalidate).toHaveBeenCalledWith('scoreboard:options');
});
