// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const pageState = vi.hoisted(() => ({
  store: undefined,
}));

vi.mock('$app/environment', async (importOriginal) => ({
  ...(await importOriginal()),
  browser: true,
}));

vi.mock('$app/stores', async () => {
  const { readable, writable } = await import('svelte/store');
  const page = writable();
  pageState.store = page;
  return { page, navigating: readable(null), updated: readable(false) };
});

await import('$app/stores');

const nativeFetch = globalThis.fetch;

function warmingResponse() {
  return {
    thresholds: [10, 20],
    defaultThreshold: 10,
    years: [2030, 2050, 2100],
    today: [0.1, 0.2],
    data: {
      'High ambition': [[0.2, 0.3, 0.4], [0.4, 0.5, 0.6]],
      'Current policies': [[0.1, 0.2, 0.3], [0.15, 0.25, 0.35]],
    },
    formats: ['csv'],
    model: 'Test model',
    source: 'Test source',
    title: 'Heat risk by warming pathway',
  };
}

function expectWarmingRequest(input) {
  const url = new URL(String(input), 'https://provide.example');
  expect(url.pathname).toBe('/api/unavoidable-risk/');
  expect(url.searchParams.get('indicator')).toBe('Heat risk');
  expect(url.searchParams.get('instance')).toBe('provide-internal');
  expect(url.searchParams.get('geography')).toBe('DEU');
  expect(url.searchParams.get('time')).toBe('Annual');
  expect(url.searchParams.getAll('scenarios')).toEqual(['High ambition', 'Current policies']);
  return Response.json(warmingResponse());
}

async function expectRenderedEnsemble() {
  await screen.findByRole('heading', { name: 'Heat risk by warming pathway' });
  await waitFor(() => {
    expect(document.querySelectorAll('circle[title="High ambition"]').length).toBe(2);
    expect(document.querySelectorAll('circle[title="Current policies"]').length).toBe(2);
    expect(document.querySelector('circle[title="Low risk later"]')).toBeNull();
    expect(document.body.textContent).toContain('25\u202f% in 2050');
  });
}

beforeEach(() => {
  pageState.store.set({ url: new URL('https://provide.example/'), params: {}, data: {} });
  vi.stubEnv('VITE_API_URL', 'https://provide.example/api');
  vi.stubEnv('VITE_APP_URL', 'https://provide.example/app');
  vi.stubEnv('VITE_SCREENSHOT_URL', 'https://screenshots.example');
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
});

afterEach(() => {
  cleanup();
  globalThis.fetch = nativeFetch;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('warming graph embed', () => {
  test('preserves the selected threshold and same-timeframe ensemble through its export URL', async () => {
    globalThis.fetch = vi.fn(expectWarmingRequest);
    const { default: Fixture } = await import('./warming.test.fixture.svelte');
    const source = render(Fixture);

    await expectRenderedEnsemble();
    await fireEvent.click(screen.getByRole('button', { name: 'Download graph' }));
    const download = await screen.findByRole('button', { name: 'Download graph as png file' });
    const graphUrl = new URL(download.dataset.graph);

    expect(graphUrl.pathname).toBe('/embed/unavoidable-risk');
    expect(graphUrl.searchParams.get('threshold')).toBe('20');
    expect(graphUrl.searchParams.get('timeframe')).toBe('2050');
    expect(graphUrl.searchParams.get('scenarios[0]')).toBe('High ambition');
    expect(graphUrl.searchParams.get('allScenarios[0]')).toBe('High ambition');
    expect(graphUrl.searchParams.get('allScenarios[1]')).toBe('Current policies');
    expect(graphUrl.searchParams.has('allScenarios[2]')).toBe(false);

    source.unmount();
    pageState.store.set({ url: graphUrl, params: { embed: 'unavoidable-risk' }, data: {} });
    render(Fixture, { embed: true });

    await expectRenderedEnsemble();
  });
});
