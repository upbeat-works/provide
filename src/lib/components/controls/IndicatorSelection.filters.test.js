// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import { runtimeCatalog } from '$stores/runtime-catalog.js';
import IndicatorSelection from './IndicatorSelection.svelte';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('offers filters after the region indicator request fails', async () => {
  const heat = { id: 'Heat', label: 'Heat', instance: 'source-b', unit: 'days' };
  const flood = { id: 'Flood', label: 'Flood', instance: 'source-b', unit: 'm' };
  const sector = { key: 'Sector', label: 'Sector', color: 'grass' };
  const health = { value: 'Health', count: 1 };
  const water = { value: 'Water', count: 1 };
  const filters = [{ ...sector, options: [health, water] }];
  const scopedFilters = [{ ...sector, options: [health, { ...water, count: 0 }] }];
  const franceResponse = Promise.withResolvers();
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname.endsWith('/api/indicators/filters')) return Response.json({ filters, failedInstances: [] });
    if (!url.pathname.endsWith('/api/indicators')) throw new Error(`Unexpected request: ${url}`);
    if (!url.searchParams.has('region')) return Response.json({ indicators: [heat, flood], failedInstances: [] });
    if (url.searchParams.get('region') === 'France') return franceResponse.promise;
    if (url.searchParams.get('Sector') === 'Health') return Response.json({ indicators: [heat], failedInstances: [], filters: scopedFilters });
    return Response.json({ error: 'Offline' }, { status: 503 });
  }));
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    disconnect() {}
  });
  HTMLElement.prototype.scrollTo = vi.fn();
  runtimeCatalog.selectGeography('Spain');
  await runtimeCatalog.loadIndicatorIndex();
  render(IndicatorSelection);
  await fireEvent.click(screen.getByRole('button', { name: 'Select an indicator' }));
  await screen.findByRole('button', { name: 'Retry indicators' });

  await fireEvent.click(screen.getByRole('button', { name: /Advanced Filters/ }));
  await fireEvent.click(await screen.findByRole('button', { name: /Health/ }));

  await waitFor(() => expect(screen.getByRole('button', { name: 'Water' }).disabled).toBe(true));
  expect(screen.getByRole('radio', { name: 'Heat' })).toBeTruthy();
  expect(screen.queryByRole('radio', { name: 'Flood' })).toBeNull();

  runtimeCatalog.selectGeography('France');
  expect((await screen.findByRole('button', { name: 'Water 1' })).disabled).toBe(false);
  franceResponse.resolve(Response.json({ error: 'Offline' }, { status: 503 }));
  await screen.findByRole('button', { name: 'Retry indicators' });
  expect(screen.getByRole('button', { name: 'Water 1' }).disabled).toBe(false);
  expect(screen.getByRole('button', { name: /Clear/ })).toBeTruthy();
});
