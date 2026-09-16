// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Page from './page.test.fixture.svelte';
import { getScoreboard } from './controller.js';

const { goto } = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto }));
vi.mock('./components/ScoreboardMap.svelte', () => import('./components/Map.test.fixture.svelte'));

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

test('omits links for charts whose resolved data is empty', () => {
  const data = dataFor('adapter-empty');
  render(Page, { data });
  expect(screen.getByRole('img', { name: 'Mock country map' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: data.charts[0].definition.title })).toBeNull();
});

test.each(['empty', 'error'])('keeps the base map visible for a %s chart result', (status) => {
  render(Page, { data: dataFor(status) });
  expect(screen.getByRole('img', { name: 'Mock country map' })).toBeTruthy();
  if (status === 'error') expect(screen.getByText('Data could not be loaded')).toBeTruthy();
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
