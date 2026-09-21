// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import ScoreboardMap from './ScoreboardMap.svelte';
import { COUNTRY_SOURCE } from './choropleth.js';

vi.mock('$app/environment', () => ({ browser: true }));
// The fixture stands in for MapProvider and renders no slot, so the choropleth
// layers never mount and the band can be tested without a Mapbox context.
vi.mock('$lib/components/maps/MapboxMap/MapProvider.svelte', () => import('./ScoreboardMap.test.fixture.svelte'));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ring = (west, south, east, north) => [
  [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ],
];
const country = (geoId, box) => ({ type: 'Feature', properties: { geoId }, geometry: { type: 'Polygon', coordinates: ring(...box) } });
const shapes = { type: 'FeatureCollection', features: [country('ESP', [-9, 36, 4, 44]), country('FIN', [19, 59, 31, 70])] };

function stubFetch(handler) {
  const fetcher = vi.fn(handler);
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

test('shows loading and lets the user retry failed country geometry', async () => {
  let attempts = 0;
  let releaseFailure;
  const failure = new Promise((resolve) => {
    releaseFailure = resolve;
  });
  stubFetch(async () => {
    attempts += 1;
    if (attempts === 1) {
      await failure;
      return new Response('', { status: 503 });
    }
    return Response.json(shapes);
  });

  render(ScoreboardMap, { highlight: 'ESP' });
  expect(screen.getByRole('status').textContent).toContain('Loading map');
  expect(screen.queryByText('Country map')).toBeNull();
  releaseFailure();
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  await fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
  await waitFor(() => expect(screen.getByText('Country map')).toBeTruthy());
  expect(screen.queryByRole('alert')).toBeNull();
  expect(attempts).toBe(2);
});

test('draws the R9 map without fetching the country geometry', async () => {
  const fetcher = stubFetch(async () => Response.json(shapes));
  render(ScoreboardMap, { geographyType: 'r9' });
  await waitFor(() => expect(screen.getByText('Country map')).toBeTruthy());
  expect(JSON.parse(screen.getByText('Country map').dataset.zoomRange)).toEqual([-1, 14]);
  expect(fetcher).not.toHaveBeenCalled();
});

test('fetches the bundled NUTS source once and frames the selection from it', async () => {
  const fetcher = stubFetch(async () => Response.json(shapes));
  const { rerender } = render(ScoreboardMap, { fitCountries: ['ESP'] });
  await waitFor(() => expect(screen.getByText('Country map')).toBeTruthy());
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith(COUNTRY_SOURCE);
  expect(JSON.parse(screen.getByText('Country map').dataset.bounds)).toEqual([-9, 36, 4, 44]);

  await rerender({ fitCountries: ['ESP', 'FIN'] });
  expect(JSON.parse(screen.getByText('Country map').dataset.bounds)).toEqual([-9, 36, 31, 70]);
  // Reframing reads the geometry already in hand rather than fetching again.
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('falls back to the given bounds when nothing is selected', async () => {
  stubFetch(async () => Response.json(shapes));
  render(ScoreboardMap, { bounds: [-12, 34, 34, 61] });
  await waitFor(() => expect(screen.getByText('Country map')).toBeTruthy());
  expect(JSON.parse(screen.getByText('Country map').dataset.bounds)).toEqual([-12, 34, 34, 61]);
});
