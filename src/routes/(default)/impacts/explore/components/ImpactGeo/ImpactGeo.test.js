// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
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
let requests = [];
let mismatchComparison = false;
let rasterUnit;

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
    formats: ['netcdf', 'geotiff'],
    title: `Temperature map ${year}`,
    selectableYears: [2050, 2100],
  };
}

beforeEach(() => {
  vi.stubEnv('VITE_DATA_API_URL', 'https://data.example/api');
  vi.stubEnv('VITE_API_URL', 'https://app.example/api');
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.pathname === '/api/impact-geo/') {
      const data = mapData(Number(url.searchParams.get('year')));
      if (rasterUnit) data.unit = rasterUnit;
      if (mismatchComparison && url.searchParams.get('scenario') === 'Delayed Transition') data.coordinatesOrigin = [1, 0];
      return Response.json(data);
    }
    if (url.pathname === '/api/geo-shape/') {
      return Response.json({
        data: {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: { uid: 'CMR' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 0]]] } }],
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
  requests = [];
  mismatchComparison = false;
  rasterUnit = undefined;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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
  expect(requests.filter((url) => url.pathname === '/api/impact-geo/').map((url) => url.searchParams.get('year'))).toEqual(['2050', '2100']);
  expect(requests.some((url) => url.pathname.includes('availability'))).toBe(false);
});

test('uses the first shared year when the requested year is unavailable', async () => {
  const { default: Fixture } = await import('./ImpactGeo.test.fixture.svelte');
  render(Fixture, { year: 2040 });
  await screen.findByRole('heading', { name: 'Temperature map 2050' });
  expect(screen.getByRole('combobox', { name: 'Year' }).value).toBe('2050');
});

test('downloads the selected map in NetCDF or GeoTIFF at its native resolution', async () => {
  const { default: Fixture } = await import('./ImpactGeo.test.fixture.svelte');
  render(Fixture, { year: 2050, staticMode: false });
  await screen.findByRole('heading', { name: 'Temperature map 2050' });
  await waitFor(() => expect(screen.getByRole('figure').getAttribute('aria-busy')).toBe('false'));
  await fireEvent.click(screen.getByRole('button', { name: 'Download data' }));
  const dataLink = await screen.findByRole('link', { name: 'Download data' });
  const dataUrl = new URL(dataLink.href);
  expect(dataUrl.origin + dataUrl.pathname).toBe('https://app.example/api/impact-geo/');
  expect(dataUrl.searchParams.get('scenario')).toBe('Low Demand');
  expect(dataUrl.searchParams.get('year')).toBe('2050');
  expect(dataUrl.searchParams.get('instance')).toBe('provide-internal');
  expect(dataUrl.searchParams.get('resolution')).toBe('native');
  expect(dataUrl.searchParams.get('format')).toBe('netcdf');
  await fireEvent.click(screen.getByRole('radio', { name: 'geotiff' }));
  expect(new URL(dataLink.href).searchParams.get('format')).toBe('geotiff');
  const imageButton = screen.getByRole('button', { name: /download graph/i });
  expect(imageButton).toBeTruthy();
});

test('loads both canonical scenarios in their selected order', async () => {
  const { default: Fixture } = await import('./ImpactGeo.test.fixture.svelte');
  render(Fixture, { year: 2050, compare: true });
  await screen.findByText('Low Demand');
  await screen.findByText('2020 Climate Policies');
  await waitFor(() => expect(requests.some((url) => url.searchParams.get('scenario') === '2020 Climate Policies')).toBe(true));
  await waitFor(() => expect(screen.getByRole('figure').getAttribute('aria-busy')).toBe('false'));
});

test('keeps comparison controls usable when grids cannot be subtracted', async () => {
  mismatchComparison = true;
  const { default: Fixture } = await import('./ImpactGeo.test.fixture.svelte');
  const view = render(Fixture, { year: 2050, compare: true, alternateComparison: true, displayOption: 'difference' });
  await screen.findByRole('alert');
  expect(screen.getByText('Map comparison is not available')).toBeTruthy();
  expect(screen.getByText('Map grids cannot be compared')).toBeTruthy();
  await fireEvent.click(screen.getByRole('button', { name: 'Show side by side' }));
  await waitFor(() => expect(screen.queryByText('Map comparison is not available')).toBeNull());
  await waitFor(() => expect(view.container.querySelectorAll('.map')).toHaveLength(2));
});

test('labels a side-by-side raster unit error as a map failure', async () => {
  rasterUnit = 'kelvin';
  const { default: Fixture } = await import('./ImpactGeo.test.fixture.svelte');
  render(Fixture, { year: 2050, compare: true, unitComparison: true });
  await screen.findByText('Map unavailable');
  expect(screen.queryByText('Map comparison is not available')).toBeNull();
});
