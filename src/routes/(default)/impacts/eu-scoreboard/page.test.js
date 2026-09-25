// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Page from './page.test.fixture.svelte';
import { getScoreboard } from './controller.js';
import { load } from './+layout.js';

const { goto, invalidate } = vi.hoisted(() => ({ goto: vi.fn(), invalidate: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto, invalidate }));
vi.mock('./components/ScoreboardMap.svelte', () => import('./page-map.test.fixture.svelte'));

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
    indicators: [option('Maximum Air Temperature'), option('Mean Air Temperature')],
    scenarios: [option('CurrentPolicies')],
    regions: [option('Austria')],
    years: [option('2050')],
    selection: { indicator: option('Maximum Air Temperature'), scenario: option('CurrentPolicies'), region: option('Austria'), year: option('2050') },
    charts: [],
  };
  if (status === 'empty') return data;
  if (status === 'adapter-empty') {
    data.charts = [{ definition: getScoreboard('testing').charts[0], status: 'ready', data: [{ line: [{ year: 2050, value: null }] }] }];
    return data;
  }
  data.charts = [{ definition: getScoreboard('testing').charts[0], status, data: [], error: 'failed' }];
  return data;
};

test('lists the configured map indicators without loading their values', () => {
  const data = dataFor('empty');
  data.scoreboard = getScoreboard('testing');
  render(Page, { data });
  for (const definition of data.scoreboard.map.indicators) {
    expect(screen.getByText(definition.name)).toBeTruthy();
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
    expect(url.searchParams.get('indicator')).toBe('High Heat Risk');
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

test('ranks only countries covered by the shared boundary list', async () => {
  render(Page, { data: dataFor('empty') });
  const labels = [];
  const next = screen.getByRole('button', { name: 'Next countries' });
  while (true) {
    labels.push(...rankingRows().map((row) => row.querySelector('a').textContent));
    if (next.disabled) break;
    await fireEvent.click(next);
  }

  expect(labels).toContain('Ukraine');
  expect(labels).not.toContain('Moldova');
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
  render(Page, { data: dataFor('empty'), url: new URL('http://localhost/impacts/eu-scoreboard?sector=heat-stress') });
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
  expect(url.searchParams.get('region')).toBe('Austria');
  expect(url.searchParams.get('indicator')).toBe('Maximum Air Temperature');
  expect(url.searchParams.get('year')).toBe('2050');
});

test.each(['Indicators', /Explore Heat stress indicators/])('links follow changed filters: %s', async (name) => {
  const data = dataFor('empty');
  const { rerender } = render(Page, { data });
  await rerender({
    data: { ...data, years: [option('2060')], selection: { ...data.selection, year: option('2060') } },
    url: new URL('http://localhost/impacts/eu-scoreboard?sector=heat-stress&scenario=CurrentPolicies&region=AT11&year=2060'),
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

test('view tabs add the resolved default country and keep the indicator', () => {
  render(Page, { data: dataFor('error'), url: new URL('http://localhost/impacts/eu-scoreboard?sector=testing') });
  const indicators = screen.getByRole('link', { name: 'Indicators' });
  const url = new URL(indicators.href);
  expect(url.searchParams.get('scenario')).toBe('CurrentPolicies');
  expect(url.searchParams.get('region')).toBe('Austria');
  expect(url.searchParams.get('indicator')).toBe('Maximum Air Temperature');
  expect(url.searchParams.get('year')).toBe('2050');
});

test('view tabs retain a valid country', () => {
  const data = dataFor('empty');
  data.selection.region = option('Ukraine');
  render(Page, {
    data,
    url: new URL(
      'http://localhost/impacts/eu-scoreboard?sector=heat-stress&indicator=Maximum%20Air%20Temperature&scenario=CurrentPolicies&region=Ukraine&year=2050'
    ),
  });

  expect(new URL(screen.getByRole('link', { name: 'Indicators' }).href).searchParams.get('region')).toBe('Ukraine');
});

test('sector choices come from server-loaded scoreboard data', async () => {
  const data = dataFor('empty');
  data.scoreboard = {
    ...data.scoreboard,
    sector: { uid: 'custom', label: 'Custom' },
    sectors: [{ uid: 'custom', label: 'Custom' }],
  };
  render(Page, { data });
  expect(filterButton('Topic').textContent).toContain('Custom');
  await openFilter('Topic');
  expect(screen.getAllByRole('button', { name: 'Custom' })).toHaveLength(1);
});

test('puts Geography before Topic, Scenario and Year', () => {
  render(Page, { data: dataFor('empty') });
  const fields = screen.getAllByRole('button', { name: /^(Geography|Topic|Scenario|Year):/ });
  expect(fields.map((button) => button.getAttribute('aria-label'))).toEqual([
    'Geography: All countries - ranking', 'Topic: Heat stress', 'Scenario: CurrentPolicies', 'Year: 2050',
  ]);
});

test('opens an unscored country polygon using the shared country list', async () => {
  render(Page, { data: dataFor('empty') });

  await fireEvent.click(screen.getByRole('button', { name: 'Select Turkey' }));

  expect(goto).toHaveBeenCalledOnce();
  expect(new URL(goto.mock.calls[0][0], 'http://localhost').searchParams.get('region')).toBe('Turkey');
});

test('country navigation from ranking resets a previously selected indicator', async () => {
  const scoreboard = getScoreboard('testing', 'Mean Air Temperature');
  const data = load({
    data: { scoreboard },
    url: new URL('http://localhost/impacts/eu-scoreboard?sector=testing&indicator=Mean%20Air%20Temperature&scenario=1.5C&region=Austria&year=2100'),
  });
  render(Page, { data });

  await fireEvent.click(screen.getByRole('button', { name: 'Select Turkey' }));

  const mapUrl = new URL(goto.mock.calls[0][0], 'http://localhost');
  const rankingLink = rankingRows()[0].querySelector('a');
  for (const [url, country] of [[mapUrl, 'Turkey'], [new URL(rankingLink.href), rankingLink.textContent]]) {
    const destination = load({ data: { scoreboard }, url });
    expect(destination.selection.indicator.uid).toBe('Maximum Air Temperature');
    expect(destination.selection.region.uid).toBe(country);
    expect(destination.selection.scenario.uid).toBe('1.5C');
    expect(destination.selection.year.uid).toBe('2100');
    expect(url.searchParams.get('sector')).toBe('testing');
  }
});

test.each(['All available countries', 'Austria'])('opens indicators from the geography selector: %s', async (label) => {
  render(Page, { data: dataFor('empty'), url: new URL('http://localhost/impacts/eu-scoreboard?sector=heat-stress&scenario=CurrentPolicies&year=2050') });
  await openFilter('Geography');
  await chooseOption(label);
  const url = goto.mock.calls[0][0];
  expect(url.pathname).toBe('/impacts/eu-scoreboard/indicators');
  expect(url.searchParams.get('region')).toBe(label === 'Austria' ? 'Austria' : 'all');
  expect(url.searchParams.get('year')).toBe('2050');
});

test('returns to ranking from a searched geography list and keeps other filters', async () => {
  render(Page, { data: dataFor('empty'), url: new URL('http://localhost/impacts/eu-scoreboard/indicators?sector=heat-stress&region=all&year=2050') });
  await openFilter('Geography');
  await fireEvent.input(screen.getByPlaceholderText('Search geography'), { target: { value: 'Austria' } });
  expect(screen.getByRole('button', { name: 'Austria' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'All available countries' })).toBeNull();
  await chooseOption('All countries - ranking');
  const url = goto.mock.calls[0][0];
  expect(url.pathname).toBe('/impacts/eu-scoreboard');
  expect(url.searchParams.has('region')).toBe(false);
  expect(url.searchParams.get('sector')).toBe('heat-stress');
  expect(url.searchParams.get('year')).toBe('2050');
});
