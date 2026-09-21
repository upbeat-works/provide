// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { readable, writable } from 'svelte/store';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { writeArrayBuffer } from 'geotiff';
import { processMapRequests } from '$lib/maps/impact-geo-grid.js';

const state = vi.hoisted(() => ({ page: undefined, invalidateAll: vi.fn() }));

vi.mock('$app/stores', async () => {
  state.page = writable();
  return { page: state.page, navigating: readable(null), updated: readable(false) };
});
vi.mock('$app/navigation', () => ({ invalidateAll: state.invalidateAll, goto: vi.fn() }));
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('mapbox-gl', () => ({ Map: class { constructor() { this.scrollZoom = this.boxZoom = this.dragRotate = this.dragPan = this.keyboard = this.doubleClickZoom = this.touchZoomRotate = { enable() {}, disable() {} }; } on(event, callback) { if (event === 'load') queueMicrotask(callback); } setStyle() {} fitBounds() {} flyTo() {} setPaintProperty() {} } }));
vi.mock('@mapbox/mapbox-gl-sync-move', () => ({ default: vi.fn() }));
vi.mock('$workers/geomask.js?worker', () => ({ default: class { postMessage({ geoData }) { queueMicrotask(() => this.onmessage?.({ data: { status: 'finished', data: geoData.map(({ features, label }) => ({ label, data: { type: 'FeatureCollection', features } })) } })); } terminate() {} } }));

vi.mock('$lib/workers/impact-geo.js?worker', () => ({
  default: class {
    postMessage(requests) {
      processMapRequests(requests, (data) => this.onmessage?.({ data }));
    }
    terminate() {}
  },
}));

await import('$app/stores');

const embedUrl = new URL('https://provide.example/embed/impact-geo?indicator=Mean%20Temperature&indicatorLabel=Mean%20Temperature&unit=degrees-celsius&colorScale=default&direction=1&instance=provide-internal&geography=Cameroon&geographyLabel=Cameroon&geoId=CMR&geographyType=admin0&reference=Present&time=Annual&spatial=Area&scenarios[0]=Low%20Demand&year=2040');

beforeEach(() => {
  state.page.set({ url: embedUrl, params: { embed: 'impact-geo' }, data: {} });
  state.invalidateAll.mockClear();
  vi.stubEnv('VITE_API_URL', 'https://provide.example/api');
  vi.stubEnv('VITE_DATA_API_URL', 'https://data.example/api');
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/impact-geo/') {
      const tiff = writeArrayBuffer(new Float32Array([1, 2, 3, 4]), {
        width: 2, height: 2, ModelPixelScale: [1, 1, 0], ModelTiepoint: [0, 0, 0, -0.5, 1.5, 0],
        GeographicTypeGeoKey: 4326, GTModelTypeGeoKey: 2, GTRasterTypeGeoKey: 1,
      });
      return new Response(tiff, { headers: { 'content-type': 'image/tiff' } });
    }
    if (url.pathname === '/api/geo-shape/') return Response.json({ data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { uid: 'CMR' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [0, 0]]] } }] } });
    throw new Error(`Unexpected request: ${url}`);
  }));
  vi.stubGlobal('Worker', class {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect() {}, fillRect() {}, createLinearGradient: () => ({ addColorStop() {} }), set fillStyle(value) {} });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test('uses server-discovered years when a ready map embed loads its grid', async () => {
  const { default: Fixture } = await import('./map-page.test.fixture.svelte');
  render(Fixture, { data: { mapView: { status: 'ready', years: [2030, 2050], selection: { indicator: 'Mean Temperature', instance: 'provide-internal', geography: 'Cameroon', reference: 'Present', time: 'Annual', spatial: 'Area', scenarios: ['Low Demand'] } } } });
  await screen.findByRole('heading', { name: 'Mean Temperature map 2030' });
  const request = globalThis.fetch.mock.calls.map(([input]) => new URL(String(input))).find((url) => url.pathname === '/api/impact-geo/');
  expect(request.searchParams.get('year')).toBe('2030');
});

test('shows map failures with retry and hides valid empty availability', async () => {
  const { default: Fixture } = await import('./map-page.test.fixture.svelte');
  const view = render(Fixture, { data: { mapView: { status: 'failure', message: 'GeoServer unavailable', selection: { indicator: 'Mean Temperature' } } } });
  await fireEvent.click(screen.getByRole('button', { name: 'Retry map scenarios' }));
  expect(state.invalidateAll).toHaveBeenCalledTimes(1);
  await view.rerender({ data: { mapView: { status: 'empty', selection: { indicator: 'Mean Temperature' } } } });
  await waitFor(() => expect(screen.queryByText('Scenario availability could not be loaded')).toBeNull());
  expect(screen.queryByText('The chart URL is incomplete.')).toBeNull();
});
