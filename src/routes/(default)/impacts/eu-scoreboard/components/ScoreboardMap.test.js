// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import ScoreboardMap from './ScoreboardMap.svelte';
import { COUNTRY_SOURCE } from './choropleth.js';
import { loadRegionalBoundaries } from '../../../../../../api/scoreboard/boundaries.ts';

vi.mock('$app/environment', () => ({ browser: true }));
// The fixture stands in for MapProvider and renders no slot, so the choropleth
// layers never mount and the band can be tested without a Mapbox context.
vi.mock('$lib/components/maps/MapboxMap/MapProvider.svelte', () => import('./ScoreboardMap.test.fixture.svelte'));
vi.mock('$lib/components/maps/MapboxMap/ZoomControl.svelte', () => import('./Empty.test.fixture.svelte'));
vi.mock('./NutsChoropleth.svelte', () => import('./CountryMapLayer.test.fixture.svelte'));
vi.mock('./RegionalChoropleth.svelte', () => import('./RegionalMapLayer.test.fixture.svelte'));
vi.mock('./RasterGrid.svelte', () => import('./RasterGrid.test.fixture.svelte'));
vi.mock('../../../../../../api/scoreboard/boundaries.ts', () => ({ loadRegionalBoundaries: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(loadRegionalBoundaries).mockReset();
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
const shapes = {
  type: 'FeatureCollection',
  features: [country('ESP', [-9, 36, 4, 44]), country('FIN', [19, 59, 31, 70]), country('AUT', [9, 46, 17, 49]), country('FRA', [-5, 41, 9, 51])],
};

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

test('frames and outlines the selected country while regional boundaries are pending', async () => {
  let finish;
  vi.mocked(loadRegionalBoundaries).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  stubFetch(async () => Response.json(shapes));

  render(ScoreboardMap, { countryName: 'Austria', level: 'NUTS2' });

  await waitFor(() => expect(screen.getByText('Country map')).toBeTruthy());
  expect(JSON.parse(screen.getByText('Country map').dataset.bounds)).toEqual([9, 46, 17, 49]);
  expect(screen.getByTestId('country-outline').dataset.highlight).toBe('AUT');
  expect(screen.getByRole('status').textContent).toContain('Loading regional boundaries');
  finish({ type: 'FeatureCollection', features: [] });
});

test('loads the current NUTS level and country and ignores an older boundary response', async () => {
  let finishAustria;
  let finishFrance;
  vi.mocked(loadRegionalBoundaries)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finishAustria = resolve;
      })
    )
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finishFrance = resolve;
      })
    );
  stubFetch(async () => Response.json(shapes));
  const { rerender } = render(ScoreboardMap, { countryName: 'Austria', level: 'NUTS2' });
  await waitFor(() => expect(loadRegionalBoundaries).toHaveBeenCalledWith('AT', 'NUTS2'));

  await rerender({ countryName: 'France', level: 'NUTS1' });
  expect(loadRegionalBoundaries).toHaveBeenLastCalledWith('FR', 'NUTS1');
  finishAustria({ type: 'FeatureCollection', features: [{ properties: { NUTS_ID: 'AT11' } }] });
  await Promise.resolve();
  expect(screen.queryByRole('img', { name: 'Regional map layer' })).toBeNull();

  const france = { type: 'FeatureCollection', features: [{ properties: { NUTS_ID: 'FR1' } }] };
  finishFrance(france);
  await waitFor(() => expect(JSON.parse(screen.getByRole('img', { name: 'Regional map layer' }).dataset.shape)).toEqual(france));
});

test('keeps the country map on a boundary failure and retries that request', async () => {
  vi.mocked(loadRegionalBoundaries).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ type: 'FeatureCollection', features: [] });
  stubFetch(async () => Response.json(shapes));
  render(ScoreboardMap, { countryName: 'Austria', level: 'NUTS2' });

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByText('Country map')).toBeTruthy();
  await fireEvent.click(screen.getByRole('button', { name: 'Retry boundaries' }));
  await waitFor(() => expect(loadRegionalBoundaries).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Country map')).toBeTruthy();
});

test('draws a raster grid inside the selected country frame without loading regional boundaries', async () => {
  stubFetch(async () => Response.json(shapes));
  const grid = { coordinatesOrigin: [10, 46], resolution: 1, data: [[1]] };
  const classes = [{ min: 1, label: '1 °C', color: '#fff2cc' }];

  render(ScoreboardMap, { countryName: 'Austria', grid, classes, values: [{ value: 1 }] });

  await waitFor(() => expect(screen.getByRole('img', { name: 'Raster map layer' })).toBeTruthy());
  const raster = screen.getByRole('img', { name: 'Raster map layer' });
  expect(JSON.parse(raster.dataset.grid)).toEqual(grid);
  expect(JSON.parse(raster.dataset.mask)).toEqual(country('AUT', [9, 46, 17, 49]));
  expect(screen.getByTestId('country-outline').dataset.highlight).toBe('AUT');
  expect(loadRegionalBoundaries).not.toHaveBeenCalled();
});

test('shows regional boundaries across Europe without framing one country', async () => {
  stubFetch(async () => Response.json(shapes));
  const regions = { type: 'FeatureCollection', features: [country('AT11', [9, 46, 17, 49]), country('FR10', [-5, 41, 9, 51])] };
  vi.mocked(loadRegionalBoundaries).mockResolvedValue(regions);
  render(ScoreboardMap, { countryName: 'all', level: 'NUTS2' });
  await waitFor(() => expect(screen.getByRole('img', { name: 'Regional map layer' })).toBeTruthy());
  expect(loadRegionalBoundaries).toHaveBeenCalledWith(undefined, 'NUTS2');
  expect(JSON.parse(screen.getByRole('img', { name: 'Regional map layer' }).dataset.shape)).toEqual(regions);
  expect(JSON.parse(screen.getByText('Country map').dataset.bounds)).toEqual([-24, 34, 45, 72]);
});
