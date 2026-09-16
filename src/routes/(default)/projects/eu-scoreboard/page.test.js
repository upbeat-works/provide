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

test('shows a five-country mock ranking from the same values as the map', () => {
  render(Page, { data: dataFor('empty') });
  const map = screen.getByRole('img', { name: 'Mock country map' });
  const values = JSON.parse(map.dataset.values);
  expect(Number(map.dataset.classCount)).toBeGreaterThan(0);
  const ranking = screen.getByText('Mock data').parentElement.querySelector('ol');
  const rows = [...ranking.querySelectorAll('li')];
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

test('selection changes keep the sector and request new API-backed data', async () => {
  render(Page, { data: dataFor('empty'), url: new URL('http://localhost/projects/eu-scoreboard?sector=heat-stress') });
  await fireEvent.change(screen.getByRole('combobox', { name: 'Scenario' }), { target: { value: 'CurrentPolicies' } });
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

test('sector choices come from server-loaded scoreboard data', () => {
  const data = dataFor('empty');
  data.scoreboard = {
    ...data.scoreboard,
    sector: { uid: 'custom', label: 'Custom' },
    sectors: [{ uid: 'custom', label: 'Custom' }],
  };
  render(Page, { data });
  const sector = screen.getByRole('combobox', { name: 'Hazard/Sector' });
  expect([...sector.options].map(({ value }) => value)).toEqual(['custom']);
});

test('keeps the selected year visible and other choices usable after a year lookup failure', async () => {
  const data = dataFor();
  data.selection.year = option('2070');
  data.scoreboardOptions = { status: 'ready', yearStatus: 'error', yearError: 'Years could not be loaded.' };
  render(Page, { data });
  expect(screen.getByRole('combobox', { name: 'Year' }).value).toBe('2070');
  expect(screen.getByRole('combobox', { name: 'Scenario' }).disabled).toBe(false);
  expect(screen.getByRole('combobox', { name: 'Region' }).disabled).toBe(false);
  expect(screen.getByRole('alert').textContent).toContain('Years could not be loaded.');
  await fireEvent.click(screen.getByRole('button', { name: 'Retry choices' }));
  expect(invalidate).toHaveBeenCalledWith('scoreboard:options');
});
