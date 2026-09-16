// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import ScoreboardMap from './ScoreboardMap.svelte';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/components/maps/MapboxMap/MapProvider.svelte', () => import('./ScoreboardMap.test.fixture.svelte'));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
let testId = 0;
beforeEach(() => vi.stubEnv('VITE_DATA_API_URL', `https://maps.example/test-${++testId}`));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());

test('shows loading and lets the user retry failed country geometry', async () => {
  let attempts = 0;
  let releaseFailure;
  const failure = new Promise((resolve) => {
    releaseFailure = resolve;
  });
  server.use(
    http.get(/\/geo-shape\//, async () => {
      attempts += 1;
      if (attempts === 1) {
        await failure;
        return HttpResponse.json({}, { status: 503 });
      }
      return HttpResponse.json({ data: { type: 'FeatureCollection', features: [] } });
    })
  );

  render(ScoreboardMap, { highlight: 'DEU' });
  expect(screen.getByRole('status').textContent).toContain('Loading data');
  expect(screen.queryByText('Country map')).toBeNull();
  releaseFailure();
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  await fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
  await waitFor(() => expect(screen.getByText('Country map')).toBeTruthy());
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(attempts).toBe(2);
});

test('fits the world map within a narrow viewport', () => {
  render(ScoreboardMap, { geographyType: 'r9' });
  expect(JSON.parse(screen.getByText('Country map').dataset.zoomRange)).toEqual([-1, 14]);
});

test('fits selected countries outside Europe and updates when the area changes', async () => {
  const feature = (uid, west, south, east, north) => ({
    type: 'Feature',
    properties: { uid },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  });
  server.use(http.get(/\/geo-shape\//, () => HttpResponse.json({ data: { type: 'FeatureCollection', features: [feature('BRA', -74, -34, -34, 5), feature('ARG', -73, -55, -53, -21)] } })));
  const { rerender } = render(ScoreboardMap, { fitCountries: ['BRA'], geographyType: 'admin0' });
  await waitFor(() => expect(screen.getByText('Country map')).toBeTruthy());
  expect(JSON.parse(screen.getByText('Country map').dataset.bounds)).toEqual([-74, -34, -34, 5]);
  await rerender({ fitCountries: ['BRA', 'ARG'] });
  expect(JSON.parse(screen.getByText('Country map').dataset.bounds)).toEqual([-74, -55, -34, 5]);
});
