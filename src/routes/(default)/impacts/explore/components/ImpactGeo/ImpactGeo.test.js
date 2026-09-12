// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('svelte', async () => ({
  ...(await vi.importActual('svelte')),
  onMount: (await vi.importActual('svelte/internal')).onMount,
}));

vi.mock('mapbox-gl', () => ({
  Map: class {
    constructor() {
      this.scrollZoom = this.boxZoom = this.dragRotate = this.dragPan = this.keyboard = this.doubleClickZoom = this.touchZoomRotate = { enable() {}, disable() {} };
    }
    on(event, callback) {
      if (event === 'load') queueMicrotask(callback);
    }
    setStyle() {}
    fitBounds() {}
    flyTo() {}
    setPaintProperty() {}
  },
}));

vi.mock('@mapbox/mapbox-gl-sync-move', () => ({ default: vi.fn() }));

const worker = { posts: 0 };

vi.mock('$workers/geomask.js?worker', () => ({
  default: class {
    postMessage({ geoData }) {
      worker.posts += 1;
      setTimeout(() => this.onmessage?.({
        data: {
          status: 'finished',
          data: geoData.map(({ features, label }) => ({ label, data: { type: 'FeatureCollection', features } })),
        },
      }), 0);
    }
    terminate() {}
  },
}));

function mapData(year) {
  return {
    data: [[year, year + 1], [year + 2, year + 3]],
    coordinatesOrigin: [0, 0],
    resolution: 1,
    model: 'Test model',
    source: 'Test source',
    resolutions: [1],
    formats: ['csv'],
    title: `Temperature map ${year}`,
    selectableYears: [2050, 2100],
  };
}

beforeEach(() => {
  vi.stubEnv('VITE_DATA_API_URL', 'https://data.example/api');
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/impact-geo/') return Response.json(mapData(Number(url.searchParams.get('year'))));
    if (url.pathname === '/api/geo-shape/') {
      return Response.json({
        data: {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: { uid: 'AFG' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 0]]] } }],
        },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
  vi.stubGlobal('Worker', class {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect() {},
    fillRect() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    set fillStyle(value) {},
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
});

afterEach(() => {
  cleanup();
  worker.posts = 0;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

test('settles map processing after the request and a year change', async () => {
  const { default: Fixture } = await import('./ImpactGeo.test.fixture.svelte');
  const view = render(Fixture, { year: 2050 });

  await screen.findByRole('heading', { name: 'Temperature map 2050' });
  await waitFor(() => expect(worker.posts).toBeGreaterThan(0));
  await waitFor(() => expect(screen.getByRole('figure').getAttribute('aria-busy')).toBe('false'));
  const firstRuns = worker.posts;
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(worker.posts).toBe(firstRuns);

  await view.rerender({ year: 2100 });

  await screen.findByRole('heading', { name: 'Temperature map 2100' });
  await waitFor(() => expect(worker.posts).toBeGreaterThan(firstRuns));
  await waitFor(() => expect(screen.getByRole('figure').getAttribute('aria-busy')).toBe('false'));
  const secondRuns = worker.posts;
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(worker.posts).toBe(secondRuns);
});
