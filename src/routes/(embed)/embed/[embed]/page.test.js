// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readable } from 'svelte/store';

vi.mock('$app/environment', async (importOriginal) => ({
  ...(await importOriginal()),
  browser: true,
}));

vi.mock('$app/stores', () => ({
  page: readable({
    url: new URL('https://provide.example/embed/impact-time?indicator=Heat&instance=provide-internal&geography=DEU&scenarios[0]=Low%20Demand&time=Annual'),
    params: { embed: 'impact-time' },
    data: {},
  }),
  navigating: readable(null),
  updated: readable(false),
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}));

const nativeFetch = globalThis.fetch;

function createFetch({ failAvailabilityOnce = false } = {}) {
  let availabilityFailed = false;

  return vi.fn(async (input) => {
    const url = new URL(String(input), 'https://provide.example');

    if (url.pathname === '/api/indicators' && !url.search) {
      return Response.json({
        indicators: [{ id: 'Heat', label: 'Heat stress', unit: 'days', instance: 'provide-internal' }],
        failedInstances: [],
      });
    }
    if (url.pathname === '/api/indicators' && url.searchParams.get('region') === 'DEU') {
      return Response.json({
        indicators: [{ id: 'Heat', label: 'Heat stress', unit: 'days', instance: 'provide-internal' }],
        failedInstances: [],
      });
    }
    if (url.pathname === '/api/geographies') {
      return Response.json([{ id: 'DEU', label: 'Germany', geographyType: 'admin0', parents: [] }]);
    }
    if (url.pathname === '/api/geographies/types') {
      return Response.json([{ id: 'admin0', label: 'Countries', labelSingular: 'Country', isSelectable: true }]);
    }
    if (url.pathname === '/app/indicator-details/Heat') {
      return Response.json({
        id: 'Heat',
        instance: 'provide-internal',
        unit: 'days',
        parameters: [{ id: 'time', label: 'Time', options: [{ id: 'Annual', label: 'Annual' }] }],
        models: [],
        sources: [],
      });
    }
    if (url.pathname === '/api/geography-availability') {
      return Response.json({ geographyIds: ['DEU'] });
    }
    if (url.pathname === '/api/scenario-availability') {
      if (failAvailabilityOnce && !availabilityFailed && url.searchParams.get('axis') === 'percentile') {
        availabilityFailed = true;
        return Response.json({ error: 'Scenario service unavailable' }, { status: 503 });
      }
      return Response.json({ scenarios: [{ id: 'Low Demand', label: 'Low Demand', yearStart: 2020, yearEnd: 2030 }] });
    }
    if (url.pathname === '/api/impact-time/') {
      const expected = {
        geography: 'DEU',
        indicator: 'Heat',
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
        title: 'Heat stress projection',
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
  });

  test('loads the chart after scenario availability recovers', async () => {
    await renderEmbed({ failAvailabilityOnce: true });

    await fireEvent.click(await screen.findByRole('button', { name: 'Retry chart scenarios' }));

    await waitFor(() => {
      expectRenderedChart();
    });
  });
});
