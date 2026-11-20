// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import { catalogFlow } from '$stores/catalog-flow.js';
import { runtimeCatalog } from '$stores/runtime-catalog.js';
import { SELECTION_MODE } from '$stores/state.js';
import AdvancedFilters from './AdvancedFilters.svelte';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('keeps geography choices available across facet changes and refreshes them when the geography or mode changes', async () => {
  const franceResponse = Promise.withResolvers();
  const sector = { key: 'Sector', label: 'Sector', color: 'grass' };
  const health = { value: 'Health', count: 2 };
  const water = { value: 'Water', count: 1 };
  const marine = { value: 'Maritime Climate', count: 4 };
  let franceAttempts = 0;
  const requests = [];
  vi.stubGlobal('fetch', async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/indicators') {
      return Response.json({ indicators: [], failedInstances: [], filters: [{ ...sector, options: [health, { ...water, count: 0 }] }] });
    }
    if (url.pathname !== '/api/indicators/filters') throw new Error(`Unexpected request: ${url}`);
    requests.push(url.search);
    const region = url.searchParams.get('region');
    if (region === 'France' && ++franceAttempts === 1) return franceResponse.promise;
    let options = [health, water, marine];
    if (region === 'Germany') options = [health, water, { ...marine, count: 0 }];
    if (region === 'France') options = [marine];
    return Response.json({ filters: [{ ...sector, options }], failedInstances: [] });
  });
  SELECTION_MODE.set('geography');
  runtimeCatalog.selectGeography('Germany');
  render(AdvancedFilters);
  expect(requests).toEqual([]);
  await fireEvent.click(screen.getByRole('button', { name: /Advanced Filters/ }));
  await screen.findByRole('button', { name: 'Health 2' });
  expect(screen.queryByRole('button', { name: /Maritime Climate/ })).toBeNull();

  await catalogFlow.applyFilters({ Sector: ['Health'] }, { mode: 'geography', geography: 'Germany' });
  expect(screen.getByRole('button', { name: 'Water 1' }).disabled).toBe(false);
  await fireEvent.click(screen.getByRole('button', { name: 'Water 1' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Health 2' }));
  await catalogFlow.syncIndicatorScope({ mode: 'geography', geography: 'Germany', filters: { Sector: ['Water'] } });
  expect(screen.getByRole('button', { name: 'Health 2' }).disabled).toBe(false);
  expect(requests).toEqual(['?region=Germany']);

  runtimeCatalog.selectGeography('France');
  await screen.findByText('Loading advanced filters…');
  expect(screen.queryByRole('button', { name: 'Health 2' })).toBeNull();
  franceResponse.resolve(Response.json({ error: 'Offline' }, { status: 503 }));
  await fireEvent.click(await screen.findByRole('button', { name: 'Retry advanced filters' }));
  await screen.findByRole('button', { name: 'Maritime Climate 4' });
  expect(screen.queryByRole('button', { name: 'Health 2' })).toBeNull();
  await fireEvent.click(screen.getByRole('button', { name: /Clear/ }));

  SELECTION_MODE.set('indicator');
  await screen.findByRole('button', { name: 'Health 2' });
  expect(screen.getByRole('button', { name: 'Maritime Climate 4' })).toBeTruthy();
  SELECTION_MODE.set('geography');
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Health 2' })).toBeNull());
  await fireEvent.click(screen.getByRole('button', { name: /Advanced Filters/ }));
  await fireEvent.click(screen.getByRole('button', { name: /Advanced Filters/ }));
  await screen.findByRole('button', { name: 'Maritime Climate 4' });
  expect(requests).toEqual(['?region=Germany', '?region=France', '?region=France', '']);
});
