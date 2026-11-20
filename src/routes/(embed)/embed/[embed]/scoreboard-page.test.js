import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page } from '$app/stores';
import { stringify } from 'qs';
import { safeCaseStudyEmbedUrl } from '$lib/catalog/case-study-embed-url.js';
import { load } from './+page.server.js';
import Fixture from './page.test.fixture.svelte';

const { saveAs, copy } = vi.hoisted(() => ({ saveAs: vi.fn(), copy: vi.fn(() => true) }));
vi.mock('file-saver', () => ({ default: saveAs }));
vi.mock('copy-to-clipboard', () => ({ default: copy }));
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
const queryOptions = { arrayFormat: 'comma', commaRoundTrip: true, encodeValuesOnly: true };

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
  copy.mockClear();
});

async function renderEmbed(query = {}, chartResult = result) {
  const params = { embed: 'eu-scoreboard-chart' };
  const url = new URL(`https://provide.example/embed/${params.embed}?${stringify({ chart: chartResult.definition, ...selections, ...query }, queryOptions)}`);
  const fetch = vi.fn(async (_input, init) => {
    expect(JSON.parse(init.body)).toEqual(chartResult.definition);
    return Response.json(chartResult);
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

test('copies a live chart link that loads the same chart in a case study', async () => {
  const chartResult = groupedLines('line_with_range');
  const fetchChart = await renderEmbed({}, chartResult);
  await fireEvent.click(screen.getByRole('button', { name: 'Download graph' }));
  await fireEvent.click(await screen.findByRole('button', { name: 'Click to copy the link to the clipboard' }));
  expect(copy).toHaveBeenCalledOnce();
  const url = new URL(safeCaseStudyEmbedUrl(copy.mock.calls[0][0]), 'https://provide.example');
  expect(url.searchParams.get('static')).toBeNull();
  const embedded = await load({ fetch: fetchChart, params: { embed: 'eu-scoreboard-chart' }, url });
  expect(embedded.scoreboardChart).toEqual(chartResult);
  expect(embedded.selection).toEqual(Object.fromEntries(Object.entries(selections).map(([key, uid]) => [key, { uid, label: uid }])));
});

function groupedLines(chartType = 'line') {
  const data = { ...definition.data, groupBy: 'region' };
  if (chartType === 'line_with_range') {
    Object.assign(data, {
      variables: ['Temperature|Mean', 'Temperature|Low', 'Temperature|High'],
      line: 'Mean', rangeLow: 'Low', rangeHigh: 'High',
    });
  }
  return {
    definition: { ...definition, chartType, data },
    status: 'ready',
    data: ['Austria', 'Belgium', 'France'].map((uid, index) => ({
      region: { uid, label: uid },
      series: [{
        line: [{ year: 2040, value: index + 10 }, { year: 2050, value: index + 12 }],
        rangeLow: [{ year: 2040, value: index + 8 }, { year: 2050, value: index + 10 }],
        rangeHigh: [{ year: 2040, value: index + 12 }, { year: 2050, value: index + 14 }],
      }],
    })),
  };
}

const drawnLines = () => [...document.querySelectorAll('.path-line')].filter((path) => path.getAttribute('d'));

test.each(['line', 'line_with_range'])('lets readers hide and restore countries in an embedded %s chart', async (chartType) => {
  await renderEmbed({ region: 'all', inline: 'true' }, groupedLines(chartType));
  const austria = screen.getByRole('checkbox', { name: 'Austria' });
  expect(austria.checked).toBe(true);
  await waitFor(() => expect(drawnLines()).toHaveLength(3));
  const belgiumColor = drawnLines()[1].style.stroke;
  expect(belgiumColor).toBeTruthy();

  await fireEvent.click(austria);
  expect(austria.checked).toBe(false);
  await waitFor(() => expect(drawnLines()).toHaveLength(2));
  expect(drawnLines()[0].style.stroke).toBe(belgiumColor);

  await fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(screen.getByRole('status').textContent).toContain('No countries selected');
  expect(drawnLines()).toHaveLength(0);

  await fireEvent.click(screen.getByRole('checkbox', { name: 'France' }));
  await waitFor(() => expect(drawnLines()).toHaveLength(1));
  expect(screen.queryByRole('status')).toBeNull();
});

test('renders grouped lines with a legend and no picker in static mode', async () => {
  await renderEmbed({ region: 'all', static: 'true' }, groupedLines());
  await waitFor(() => expect(drawnLines()).toHaveLength(3));
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.getByText('Austria', { selector: 'span' })).toBeTruthy();
  expect(screen.getByText('Belgium', { selector: 'span' })).toBeTruthy();
  expect(screen.getByText('France', { selector: 'span' })).toBeTruthy();
});
