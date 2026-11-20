import { cleanup, render, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { afterEach, expect, test, vi } from 'vitest';
import theme from '$styles/theme-store.js';
import AvoidPage from './+page.svelte';
import { AVOID_CITY_UID, AVOID_INDICATOR_UID, AVOID_INSTANCE, AVOID_PARAMS } from '$stores/avoid-catalog.js';

const { page } = vi.hoisted(() => ({ page: { store: undefined } }));
vi.mock('$app/stores', () => {
  page.store = writable({ url: new URL('http://localhost/impacts/explore'), data: {} });
  return { page: page.store };
});
vi.mock('svelte', async () => ({
  ...(await vi.importActual('svelte')),
  onMount: (await vi.importActual('svelte/internal')).onMount,
}));
vi.mock('./components/StudyLocations/Map.svelte', () => import('../eu-scoreboard/components/Empty.test.fixture.svelte'));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const present = '2011-2020 (Present Day)';
const preindustrial = '1850-1900 (Pre-industrial)';

test.each([
  { name: 'without a prior selection', expected: 'present-day' },
  { name: 'after an incompatible selection', previous: 'Cooling Degree Hours', stored: preindustrial, expected: 'present-day' },
  { name: 'with an allowed stored reference', previous: 'Heatwave Days per Year', stored: preindustrial, both: true, expected: 'pre-industrial' },
  { name: 'with a reference selected by the URL', previous: 'Heatwave Days per Year', stored: present, linked: preindustrial, both: true, expected: 'pre-industrial' },
])('uses the linked indicator parameters on the first Avoid request $name', async ({ previous, stored, linked, both, expected }) => {
  theme.set({ color: { category: { base: ['#123', '#234', '#345'], weakest: ['#abc', '#bcd', '#cde'], strongest: ['#123', '#234', '#345'] } } });
  const avoidMeta = {
    cities: [
      { uid: 'lisbon', label: 'Lisbon' },
      { uid: 'madrid', label: 'Madrid' },
    ],
    indicators: [
      { uid: 'urbclim-heatwave-days', label: 'Heatwave days per year', availableGeographies: ['lisbon'], parameters: { reference: both ? ['present-day', 'pre-industrial'] : ['present-day'] } },
      { uid: 'urbclim-cooling-degree-hours', label: 'Cooling degree hours', availableGeographies: ['madrid'], parameters: { reference: ['pre-industrial'] } },
    ],
    indicatorParameters: [{
      uid: 'reference', label: 'Reference period', options: [
        { uid: 'present-day', label: 'Present day' },
        { uid: 'pre-industrial', label: 'Pre-industrial' },
      ],
    }],
  };
  page.store.set({ url: new URL('http://localhost/impacts/explore'), data: {} });
  let city;
  if (previous === 'Cooling Degree Hours') city = 'Madrid';
  if (previous === 'Heatwave Days per Year') city = 'Lisbon';
  AVOID_CITY_UID.set(city);
  AVOID_INDICATOR_UID.set(previous);
  AVOID_INSTANCE.set(previous ? 'provide-internal' : undefined);
  AVOID_PARAMS.set(stored ? { reference: stored } : {});
  const calls = [];
  vi.stubEnv('VITE_DATA_API_URL', 'https://avoid-link.test/api');
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const url = new URL(input);
    if (url.pathname.includes('/geo-shape/')) return Response.json({ data: { type: 'FeatureCollection', features: [] } });
    calls.push(url);
    return Response.json({ message: 'No data' }, { status: 404 });
  }));
  const url = new URL('http://localhost/impacts/avoid?geography=Lisbon&indicator=Heatwave+Days+per+Year&instance=provide-internal');
  if (linked) url.searchParams.set('reference', linked);
  const data = { avoidMeta, caseStudies: [] };
  page.store.set({ url, data });
  render(AvoidPage, { data });

  await waitFor(() => expect(calls.some(({ pathname }) => pathname.includes('/avoiding-reference/'))).toBe(true));
  const reference = calls.find(({ pathname }) => pathname.includes('/avoiding-reference/'));
  expect(Object.fromEntries(reference.searchParams)).toMatchObject({
    geography: 'lisbon', indicator: 'urbclim-heatwave-days', reference: expected,
  });
  expect(calls.every(({ searchParams }) => searchParams.get('geography') === 'lisbon')).toBe(true);
});
