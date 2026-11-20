// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import { catalogFlow } from '$stores/catalog-flow.js';
import { runtimeCatalog } from '$stores/runtime-catalog.js';
import AdvancedFilters from './AdvancedFilters.svelte';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('uses matching scoped options while global filters are pending or fail', async () => {
  const globalResponse = Promise.withResolvers();
  const filters = { Sector: ['Health'] };
  const context = { mode: 'geography', geography: 'Spain' };
  const sector = { key: 'Sector', label: 'Sector', color: 'grass' };
  vi.stubGlobal('fetch', async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/indicators/filters') return globalResponse.promise;
    if (url.pathname !== '/api/indicators') throw new Error(`Unexpected request: ${url}`);
    const result = { indicators: [], failedInstances: [] };
    const region = url.searchParams.get('region');
    if (region === 'France') return Response.json({ ...result, filters: [] });
    if (region === 'Germany') return Response.json(result);
    const waterCount = url.searchParams.has('Sector') ? 0 : 1;
    return Response.json({
      ...result,
      filters: [{ ...sector, options: [{ value: 'Health', count: 2 }, { value: 'Water', count: waterCount }] }],
    });
  });
  runtimeCatalog.selectGeography(context.geography);
  await catalogFlow.applyFilters(filters, context);
  render(AdvancedFilters);

  await fireEvent.click(screen.getByRole('button', { name: /Advanced Filters/ }));
  expect(screen.getByRole('button', { name: 'Health 2' }).disabled).toBe(false);
  expect(screen.getByRole('button', { name: 'Water' }).disabled).toBe(true);

  globalResponse.resolve(Response.json({ error: 'Offline' }, { status: 503 }));
  await catalogFlow.openAdvancedFilters();
  expect(screen.queryByRole('button', { name: 'Retry advanced filters' })).toBeNull();
  await fireEvent.click(screen.getByRole('button', { name: /Clear/ }));

  await catalogFlow.syncIndicatorScope({ ...context, filters: {} });
  expect((await screen.findByRole('button', { name: 'Water 1' })).disabled).toBe(false);
  expect(screen.queryByRole('button', { name: /Clear/ })).toBeNull();

  runtimeCatalog.selectGeography('France');
  expect(await screen.findByRole('button', { name: 'Retry advanced filters' })).toBeTruthy();
  await catalogFlow.syncIndicatorScope({ ...context, geography: 'France', filters: {} });
  expect(await screen.findByText('No advanced filters are available.')).toBeTruthy();

  runtimeCatalog.selectGeography('Germany');
  await catalogFlow.syncIndicatorScope({ ...context, geography: 'Germany', filters: {} });
  expect(await screen.findByRole('button', { name: 'Retry advanced filters' })).toBeTruthy();
});
