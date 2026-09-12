// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
const pageState = vi.hoisted(() => ({
  store: undefined,
}));

function embedPage(indicator = 'Heat') {
  return {
    url: new URL(`https://provide.example/embed/impact-time?indicator=${indicator}&instance=provide-internal&geography=DEU&scenarios[0]=Low%20Demand&time=Annual`),
    params: { embed: 'impact-time' },
    data: {},
  };
}

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

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}));


const nativeFetch = globalThis.fetch;

function createFetch({ failChartOnce = false } = {}) {
  let chartFailed = false;

  return vi.fn(async (input) => {
    const url = new URL(String(input), 'https://provide.example');

    if (url.pathname === '/api/impact-time/') {
      if (failChartOnce && !chartFailed) {
        chartFailed = true;
        return Response.json({ message: 'Chart service unavailable' }, { status: 503 });
      }
      const indicator = url.searchParams.get('indicator');
      const expected = {
        geography: 'DEU',
        instance: 'provide-internal',
        scenarios: 'Low Demand',
        time: 'Annual',
      };
      for (const [key, value] of Object.entries(expected)) {
        if (url.searchParams.get(key) !== value) throw new Error(`Unexpected ${key}: ${url.searchParams.get(key)}`);
      }
      return Response.json({
        yearStart: 2020,
        yearStep: 10,
        data: {
          'Low Demand': [
            [10, 12, 14],
            [11, 13, 15],
          ],
        },
        gmt: {
          'Low Demand': [
            [1.1, 1.2, 1.3],
            [1.2, 1.4, 1.6],
          ],
        },
        unit: 'days',
        model: 'Test model',
        source: 'Test source',
        title: indicator === 'Heat' ? 'Heat stress projection' : `${indicator} projection`,
        description: 'Projected heat stress.',
        parameters: { time: 'Annual' },
        formats: ['csv'],
      });
    }

    throw new Error(`Unexpected request: ${url.href}`);
  });
}

async function renderEmbed(options) {
  globalThis.fetch = createFetch(options);
  const { default: Fixture } = await import('./page.test.fixture.svelte');
  return render(Fixture);
}

function expectRenderedChart() {
  expect(screen.getByRole('heading', { name: 'Heat stress projection' })).toBeTruthy();
  const line = document.querySelector('.path-line');
  expect(line?.getAttribute('d')).toBeTruthy();
}

beforeEach(() => {
  pageState.store.set(embedPage());
  vi.stubEnv('VITE_API_URL', 'https://provide.example/api');
  vi.stubEnv('VITE_APP_URL', 'https://provide.example/app');
  vi.stubEnv('VITE_DATA_API_URL', 'https://data.example/api');
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
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

describe('impact time embed', () => {
  test('renders the chart selected by the embed URL', async () => {
    await renderEmbed();

    await screen.findByRole('figure');
    await waitFor(expectRenderedChart);
    expect(globalThis.fetch.mock.calls.every(([input]) => new URL(String(input)).pathname === '/api/impact-time/')).toBe(true);
  });

  test('loads the chart after its data request recovers', async () => {
    await renderEmbed({ failChartOnce: true });

    await fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expectRenderedChart();
    });
  });

  test('shows data for a new URL when the previous request finishes later', async () => {
    let finishFirst;
    const fetchChart = createFetch();
    globalThis.fetch = vi.fn((input) => {
      const url = new URL(String(input));
      if (url.searchParams.get('indicator') !== 'Heat') return fetchChart(input);
      return new Promise((resolve) => {
        finishFirst = () => fetchChart(input).then(resolve);
      });
    });
    const { default: Fixture } = await import('./page.test.fixture.svelte');
    render(Fixture);
    await waitFor(() => expect(finishFirst).toBeTypeOf('function'));

    pageState.store.set(embedPage('Flood'));
    await screen.findByRole('heading', { name: 'Flood projection' });
    await finishFirst();

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Heat stress projection' })).toBeNull());
  });

  test('reports an incomplete URL without requesting chart data', async () => {
    const invalid = embedPage();
    invalid.url.searchParams.delete('instance');
    pageState.store.set(invalid);
    globalThis.fetch = vi.fn();
    const { default: Fixture } = await import('./page.test.fixture.svelte');

    render(Fixture);

    expect((await screen.findByRole('alert')).textContent).toContain('The chart URL is incomplete.');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('reports a map URL without a unit as incomplete', async () => {
    pageState.store.set({
      url: new URL(
        'https://provide.example/embed/impact-geo?indicator=Annual%20Maximum%20Temperature&instance=provide-internal&geography=Afghanistan&geoId=AFG&geographyType=admin0&scenarios[0]=Low%20Demand&time=Annual&year=2050&static=true'
      ),
      params: { embed: 'impact-geo' },
      data: {},
    });
    globalThis.fetch = vi.fn();
    const { default: Fixture } = await import('./page.test.fixture.svelte');

    render(Fixture);

    expect((await screen.findByRole('alert')).textContent).toContain('The chart URL is incomplete.');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
