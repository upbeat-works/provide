// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import ScenarioSelection from './ScenarioSelection.svelte';
import { runtimeCatalog } from '$stores/runtime-catalog.js';
import THEME from '$styles/theme-store.js';
import colors from '$styles/color-tokens-light.json';

afterEach(() => {
  cleanup();
  runtimeCatalog.selectIndicator(undefined);
  vi.unstubAllGlobals();
});

test('replaces pending and failed scenario details and lets the user retry', async () => {
  let fail;
  const pending = new Promise((resolve) => {
    fail = resolve;
  });
  const fetcher = vi
    .fn()
    .mockReturnValueOnce(pending)
    .mockResolvedValueOnce(
      Response.json({
        id: 'Example pathway',
        instance: 'provide-internal',
        yearStart: 2020,
        yearEnd: 2100,
        description: 'Loaded pathway details',
      })
    );
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  THEME.set({ color: colors });
  runtimeCatalog.selectScenarios([]);
  runtimeCatalog.selectIndicator({ id: 'Mean Temperature', instance: 'provide-internal' });

  render(ScenarioSelection, { scenarios: [{ uid: 'Example pathway', label: 'Example pathway', startYear: 2020, endYear: 2100 }] });
  await fireEvent.click(screen.getByRole('button', { name: 'Select one or more scenarios' }));
  await fireEvent.mouseOver(screen.getByRole('checkbox', { name: 'Example pathway' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Loading data'));
  expect(screen.queryByRole('heading', { name: 'Example pathway' })).toBeNull();
  fail(Response.json({}, { status: 503 }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Scenario details could not be loaded'));
  expect(screen.queryByRole('heading', { name: 'Example pathway' })).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
  await fireEvent.click(screen.getByRole('button', { name: 'Retry details' }));
  await waitFor(() => {
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Example pathway' })).toBeTruthy();
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher).toHaveBeenLastCalledWith('/app/scenario-details/Example%20pathway?instance=provide-internal');
});
