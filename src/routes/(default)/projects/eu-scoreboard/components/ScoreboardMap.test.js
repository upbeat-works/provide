// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import ScoreboardMap from './ScoreboardMap.svelte';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/components/maps/MapboxMap/MapProvider.svelte', () => import('./ScoreboardMap.test.fixture.svelte'));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
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
