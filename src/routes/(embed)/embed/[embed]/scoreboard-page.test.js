import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page } from '$app/stores';
import { load } from './+page.server.js';
import Fixture from './page.test.fixture.svelte';

const { saveAs } = vi.hoisted(() => ({ saveAs: vi.fn() }));
vi.mock('file-saver', () => ({ default: saveAs }));
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/stores', async () => {
  const { writable, readable } = await import('svelte/store');
  return { page: writable(), navigating: readable(null), updated: readable(false) };
});

const definition = {
  chartId: 'custom-temperature', title: 'Temperature & heat', description: 'A custom chart in °C.', chartType: 'line',
  data: { variables: ['Temperature|Mean'], unit: '°C' },
};
const result = {
  definition, status: 'ready',
  series: [{ line: { variable: 'Temperature|Mean', model: 'Model', unit: '°C' } }],
  data: [{ line: [{ year: 2040, value: 10 }, { year: 2050, value: 12 }] }],
};
const selections = { scenario: 'Custom scenario', region: 'Austria', year: '2050' };

beforeEach(() => {
  vi.stubEnv('VITE_SCREENSHOT_URL', 'https://screenshot.example');
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  saveAs.mockClear();
});

async function renderEmbed(query = {}) {
  const params = { embed: 'eu-scoreboard-chart' };
  const url = new URL(`https://provide.example/embed/${params.embed}?${new URLSearchParams({ chart: JSON.stringify(definition), ...selections, ...query })}`);
  const fetch = vi.fn(async (_input, init) => {
    expect(JSON.parse(init.body)).toEqual(definition);
    return Response.json(result);
  });
  const data = await load({ fetch, params, url });
  page.set({ url, params, data });
  render(Fixture, { data });
  return fetch;
}

test('renders a URL-defined chart and downloads that chart as an image', async () => {
  const fetchChart = await renderEmbed();
  expect(screen.getByRole('heading', { name: definition.title })).toBeTruthy();
  await waitFor(() => expect(document.querySelector('.path-line')?.getAttribute('d')).toBeTruthy());

  await fireEvent.click(screen.getByRole('button', { name: 'Download graph' }));
  const download = await screen.findByRole('button', { name: 'Download graph as png file' });
  const url = new URL(download.getAttribute('data-graph'));
  expect(url.searchParams.get('static')).toBe('true');
  const exported = await load({ fetch: fetchChart, params: { embed: 'eu-scoreboard-chart' }, url });
  expect(exported.scoreboardChart).toEqual(result);
  expect(exported.selection).toEqual(Object.fromEntries(Object.entries(selections).map(([key, uid]) => [key, { uid, label: uid }])));

  const fetchImage = vi.fn(async () => new Response(new Blob(['image'], { type: 'image/png' })));
  vi.stubGlobal('fetch', fetchImage);
  await fireEvent.click(download);
  await waitFor(() => expect(saveAs).toHaveBeenCalledOnce());
  const screenshotUrl = new URL(fetchImage.mock.calls[0][0]);
  expect(screenshotUrl.searchParams.get('url')).toBe(url.href);
  const filename = saveAs.mock.calls[0][1];
  expect(filename).toContain('custom_temperature');
  expect(filename).toContain('austria');
  expect(filename).toContain('2050');
  expect(filename.length).toBeLessThan(100);
});

test('renders the chart without download controls in static mode', async () => {
  await renderEmbed({ static: 'true' });
  expect(screen.getByRole('heading', { name: definition.title })).toBeTruthy();
  await waitFor(() => expect(document.querySelector('.path-line')?.getAttribute('d')).toBeTruthy());
  expect(screen.queryByRole('button', { name: 'Download graph' })).toBeNull();
});
