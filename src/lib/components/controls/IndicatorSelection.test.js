// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import IndicatorSelection from './IndicatorSelection.svelte';
import { runtimeCatalog } from '$stores/runtime-catalog.js';
import { SELECTION_MODE } from '$stores/state.js';

const nativeFetch = globalThis.fetch;
const indicator = {
  uid: 'flood/depth',
  label: 'Flood depth',
  instance: 'source-b',
  unit: 'm',
};

beforeEach(() => {
  HTMLElement.prototype.scrollTo = vi.fn();
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  runtimeCatalog.selectIndicator(undefined);
  runtimeCatalog.selectGeography(undefined);
  globalThis.fetch = vi.fn(async (input) => {
    const url = String(input);
    if (url.includes('/app/indicator-details/')) {
      return Response.json({ id: indicator.uid, instance: indicator.instance, parameters: [] });
    }
    if (url.includes('/api/geography-availability')) {
      return Response.json({ geographyIds: [] });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
});

afterEach(() => {
  runtimeCatalog.selectIndicator(undefined);
  runtimeCatalog.selectGeography(undefined);
  runtimeCatalog.indicatorFilters.set({});
  SELECTION_MODE.set('geography');
  globalThis.fetch = nativeFetch;
  cleanup();
  vi.restoreAllMocks();
});

describe('IndicatorSelection', () => {
  test('shows progress beside the filters while a filtered list loads', async () => {
    const heat = { id: 'Heat', label: 'Heat', instance: 'source-b', unit: 'days' };
    const filters = [{ key: 'Sector', label: 'Sector', color: 'grass', options: [{ value: 'Health', count: 1 }] }];
    let finishRequest;
    const pendingResponse = new Promise((resolve) => { finishRequest = resolve; });
    globalThis.fetch = vi.fn(async (input) => {
      const url = new URL(String(input));
      if (!url.pathname.endsWith('/api/indicators')) throw new Error(`Unexpected request: ${url}`);
      if (url.searchParams.get('Sector') === 'Health') return pendingResponse;
      return Response.json({ indicators: [heat], failedInstances: [], filters });
    });
    SELECTION_MODE.set('indicator');
    await Promise.all([runtimeCatalog.loadIndicatorIndex(), runtimeCatalog.loadFilterGroups()]);
    render(IndicatorSelection);

    await fireEvent.click(screen.getByRole('button', { name: 'Select an indicator' }));
    await fireEvent.click(screen.getByRole('button', { name: /Advanced Filters/ }));
    await fireEvent.click(screen.getByRole('button', { name: /Health/ }));

    expect(get(runtimeCatalog.indicatorFilters)).toEqual({ Sector: ['Health'] });
    expect(get(runtimeCatalog.filteredIndicators).status).toBe('loading');
    expect(get(runtimeCatalog.indicatorIndex).status).toBe('success');
    await waitFor(() => expect(screen.getByText('Updating indicators…')).toBeTruthy());
    finishRequest(Response.json({ indicators: [heat], failedInstances: [], filters }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Heat' })).toBeTruthy());
  });

  test('restores the list when an empty filter is deselected', async () => {
    const heat = { id: 'Heat', label: 'Heat', instance: 'source-b', unit: 'days' };
    const flood = { id: 'Flood', label: 'Flood', instance: 'source-b', unit: 'm' };
    const filters = [{ key: 'Sector', label: 'Sector', color: 'grass', options: [{ value: 'Health', count: 1 }, { value: 'Water', count: 0 }] }];
    const emptyFilters = [{ key: 'Sector', label: 'Sector', color: 'grass', options: [{ value: 'Health', count: 0 }, { value: 'Water', count: 0 }] }];
    let regionRequests = 0;
    globalThis.fetch = vi.fn(async (input) => {
      const url = new URL(String(input));
      if (!url.pathname.endsWith('/api/indicators')) throw new Error(`Unexpected request: ${url}`);
      if (url.searchParams.get('Sector') === 'Health') return Response.json({ indicators: [], failedInstances: [], filters: emptyFilters });
      if (url.searchParams.get('region') === 'DEU' && !url.searchParams.has('Sector')) {
        regionRequests++;
        if (regionRequests > 1) return Response.json({ error: 'Repeated region request' }, { status: 503 });
      }
      return Response.json({ indicators: [heat, flood], failedInstances: [], filters });
    });
    runtimeCatalog.selectGeography('DEU');
    await Promise.all([runtimeCatalog.loadIndicatorIndex(), runtimeCatalog.loadFilterGroups()]);
    render(IndicatorSelection);

    await fireEvent.click(screen.getByRole('button', { name: 'Select an indicator' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Heat' })).toBeTruthy());
    await fireEvent.click(screen.getByRole('button', { name: /Advanced Filters/ }));
    const water = screen.getByRole('button', { name: 'Water' });
    expect(water.disabled).toBe(true);
    water.click();
    expect(get(runtimeCatalog.indicatorFilters)).toEqual({});
    await fireEvent.click(screen.getByRole('button', { name: /Health/ }));
    await waitFor(() => expect(screen.getByText('No indicators found.')).toBeTruthy());

    expect(screen.getByRole('button', { name: 'Health' }).disabled).toBe(false);
    await fireEvent.click(screen.getByRole('button', { name: 'Health' }));
    expect(get(runtimeCatalog.indicatorFilters)).toEqual({});
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Heat' })).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'Flood' })).toBeTruthy();
    });
    expect(regionRequests).toBe(1);
  });

  test('applies a staged source-bound indicator choice from the modal footer', async () => {
    render(IndicatorSelection, {
      indicatorIndexRequest: {
        status: 'success',
        data: { indicators: [indicator], failedInstances: [] },
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Select an indicator' }));
    await fireEvent.click(screen.getByRole('radio', { name: 'Flood depth' }));

    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Flood depth' })).toBeTruthy();
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/app\/indicator-details\/flood%2Fdepth\?instance=source-b$/));
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/geography-availability\?indicator=flood%2Fdepth&instance=source-b$/));
    });
  });
});
