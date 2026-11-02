import { Blob } from 'node:buffer';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page } from '$app/stores';
import { goto } from '$app/navigation';
import { getScoreboard, previewScoreboard } from '../../../../../../api/scoreboard/controller.js';
import { decodePreview, encodePreview } from '../preview.js';
import Preview from './Preview.svelte';

vi.mock('./ScoreboardMap.svelte', () => import('../indicators/map.test.fixture.svelte'));

vi.mock('$app/stores', async () => {
  const { writable } = await import('svelte/store');
  return { page: writable({ url: new URL('http://localhost/impacts/eu-scoreboard/indicators#preview') }) };
});
vi.mock('$app/navigation', async () => {
  const { page } = await import('$app/stores');
  return { goto: vi.fn(async (url) => page.set({ url: new URL(url) })) };
});
const data = { scoreboard: getScoreboard('testing') };
const draft = {
  label: 'Unsaved topic',
  map: { indicators: [], scenarios: [{ id: 'Draft scenario' }], years: [2050, 2100] },
  charts: [{ chartId: 'new-chart', title: 'New chart', description: '', chartType: 'line', data: { variables: ['Draft variable'] } }],
};
let fetcher;
beforeEach(() => {
  vi.stubGlobal('Blob', Blob);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  page.set({ url: new URL('http://localhost/impacts/eu-scoreboard/indicators#preview') });
  goto.mockClear();
  fetcher = vi.fn(async (url, options) => {
    const topic = JSON.parse(options.body);
    if (url.includes('/definition?')) {
      try { return Response.json(previewScoreboard(topic)); }
      catch (reason) { return Response.json({ error: reason.message }, { status: 400 }); }
    }
    return Response.json({ definition: topic.charts[0], status: 'empty', data: [] });
  });
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('pastes a draft, applies it, and keeps it when changing filters', async () => {
  render(Preview, { data });
  await fireEvent.input(await screen.findByLabelText('Topic JSON'), { target: { value: JSON.stringify(draft) } });
  await fireEvent.click(screen.getByRole('button', { name: 'Preview', exact: true }));
  await screen.findByText('Unsaved topic');
  expect(screen.queryByRole('dialog')).toBeNull();
  const url = goto.mock.calls[0][0];
  expect(await decodePreview(url.hash.slice('#preview='.length))).toEqual(draft);
  url.searchParams.set('year', '2100');
  page.set({ url });
  await waitFor(() => expect(fetcher.mock.calls.some(([path]) => path.includes('charts/new-chart') && path.includes('year=2100'))).toBe(true));
  for (const [, options] of fetcher.mock.calls) expect(JSON.parse(options.body)).toEqual(draft);
});

test('shows validation errors without changing the link or querying chart data', async () => {
  render(Preview, { data });
  await fireEvent.input(await screen.findByLabelText('Topic JSON'), { target: { value: JSON.stringify({ ...draft, map: { ...draft.map, years: [] } }) } });
  await fireEvent.click(screen.getByRole('button', { name: 'Preview', exact: true }));
  expect((await screen.findByRole('alert')).textContent).toContain('map.years');
  expect(goto).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('opens a shared link and reports a broken link', async () => {
  page.set({ url: new URL(`http://localhost/impacts/eu-scoreboard/indicators#preview=${await encodePreview(draft)}`) });
  render(Preview, { data });
  await screen.findByText('Unsaved topic');
  page.set({ url: new URL('http://localhost/impacts/eu-scoreboard/indicators#preview=broken') });
  expect((await screen.findByRole('alert')).textContent).toContain('Showing the last valid preview');
});

test('ignores an older draft response after a newer draft has loaded', async () => {
  let resolveFirst;
  const first = { ...draft, label: 'Old draft' };
  const next = { ...draft, label: 'Latest draft' };
  const handler = fetcher.getMockImplementation();
  fetcher.mockImplementation((url, options) => {
    if (url.includes('/definition?') && JSON.parse(options.body).label === first.label) {
      return new Promise((resolve) => { resolveFirst = resolve; });
    }
    return handler(url, options);
  });
  page.set({ url: new URL(`http://localhost/impacts/eu-scoreboard/indicators#preview=${await encodePreview(first)}`) });
  render(Preview, { data });
  await waitFor(() => expect(resolveFirst).toBeTypeOf('function'));
  page.set({ url: new URL(`http://localhost/impacts/eu-scoreboard/indicators#preview=${await encodePreview(next)}`) });
  await screen.findByText('Latest draft');
  resolveFirst(Response.json(previewScoreboard(first)));
  await waitFor(() => expect(fetcher.mock.calls.some(([path, options]) => path.includes('/charts/') && JSON.parse(options.body).label === first.label)).toBe(true));
  expect(screen.queryByText('Old draft')).toBeNull();
});

test('keeps draft data in map and chart retries and comparisons', async () => {
  const { default: Page } = await import('../indicators/+page.svelte');
  const topic = { ...draft, map: { ...draft.map, indicators: [{ name: 'Draft map', variable: 'Draft map variable', type: 'choropleth', level: 'NUTS2' }] } };
  const handler = fetcher.getMockImplementation();
  fetcher.mockImplementation(async (url, options) => {
    if (url.includes('/definition?')) return handler(url, options);
    return Response.json({ definition: topic.charts[0], status: 'error', values: [], data: [], error: 'Source unavailable' });
  });
  page.set({ url: new URL(`http://localhost/impacts/eu-scoreboard/indicators#preview=${await encodePreview(topic)}`) });
  render(Page, { data });
  await fireEvent.click(await screen.findByRole('button', { name: 'Retry map' }));
  await fireEvent.click(await screen.findByRole('button', { name: 'Retry', exact: true }));
  await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Year', exact: true }));
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.includes('/map?') && url.includes('year=2100'))).toBe(true));
  expect(fetcher.mock.calls.filter(([url]) => url.includes('/charts/'))).toHaveLength(2);
  const url = new URL(`http://localhost/impacts/eu-scoreboard/indicators?region=France#preview=${await encodePreview(topic)}`);
  page.set({ url });
  await waitFor(() => expect(screen.getAllByRole('img', { name: 'Mock country map' }).every((map) => map.dataset.country === 'France')).toBe(true));
  expect(screen.getAllByRole('img', { name: 'Mock country map' })).toHaveLength(2);
  for (const [, options] of fetcher.mock.calls) {
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(topic);
  }
});
