// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import IndicatorSelection from './IndicatorSelection.svelte';
import { runtimeCatalog } from '$stores/runtime-catalog.js';
import { catalogFlow } from '$stores/catalog-flow.js';
import { CURRENT_INDICATOR, SELECTION_MODE } from '$stores/state.js';

const resourceFixture = vi.hoisted(() => ({ client: undefined }));
vi.mock('$lib/requests/index.js', async (importOriginal) => {
  const core = await importOriginal();
  return {
    ...core,
    requestResources: {
      acquire(...args) {
        resourceFixture.client ??= core.createRequestResources();
        return resourceFixture.client.acquire(...args);
      },
    },
  };
});

const nativeFetch = globalThis.fetch;
const indicator = {
  uid: 'flood/depth',
  label: 'Flood depth',
  instance: 'source-b',
  unit: 'm',
};

beforeEach(() => {
  resourceFixture.client = undefined;
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
  cleanup();
  catalogFlow.stop();
  runtimeCatalog.selectIndicator(undefined);
  runtimeCatalog.selectGeography(undefined);
  runtimeCatalog.indicatorFilters.set({});
  SELECTION_MODE.set('geography');
  globalThis.fetch = nativeFetch;
  vi.restoreAllMocks();
});

describe('IndicatorSelection', () => {
  test('keeps a recovered selection through another geography source failure', async () => {
    const heat = { id: 'Heat', label: 'Heat', instance: 'source-b', unit: 'days' };
    globalThis.fetch = vi.fn(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname.startsWith('/app/indicator-details/')) return Response.json({ ...heat, parameters: [] });
      if (url.pathname.endsWith('/api/geography-availability')) return Response.json({ geographyIds: ['Austria'] });
      if (url.pathname.endsWith('/api/scenario-availability')) return Response.json({ scenarios: [] });
      if (!url.pathname.endsWith('/api/indicators') && !url.pathname.endsWith('/api/indicators/filters')) throw new Error(`Unexpected request: ${url}`);
      if (!url.searchParams.has('region')) {
        return Response.json({ indicators: [], failedInstances: [{ instance: 'source-b', code: 'unavailable' }] });
      }
      if (url.searchParams.get('region') === 'Austria') return Response.json({ indicators: [heat], failedInstances: [] });
      return Response.json({ indicators: [], failedInstances: [{ instance: 'source-b', code: 'unavailable' }] });
    });
    SELECTION_MODE.set('geography');
    runtimeCatalog.selectGeography('Germany');
    await runtimeCatalog.loadIndicatorIndex();
    render(IndicatorSelection);
    await fireEvent.click(screen.getByRole('button', { name: 'Select an indicator' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry missing sources' })).toBeTruthy());

    runtimeCatalog.selectGeography('Austria');

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Heat' })).toBeTruthy());
    expect(screen.queryByText('No indicators found.')).toBeNull();
    await fireEvent.click(screen.getByRole('radio', { name: 'Heat' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(get(runtimeCatalog.selection).indicator).toEqual({ id: 'Heat', instance: 'source-b' });
    await waitFor(() => expect(get(runtimeCatalog.indicatorDetails).status).toBe('success'));

    runtimeCatalog.selectGeography('France');
    await fireEvent.click(screen.getByRole('button', { name: 'Heat' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry missing sources' })).toBeTruthy());
    expect(screen.getByRole('radio', { name: 'Heat' })).toBeTruthy();
    expect(get(CURRENT_INDICATOR).unit.uid).toBe('days');
    expect(get(runtimeCatalog.selection).indicator).toEqual({ id: 'Heat', instance: 'source-b' });
  });

  test('uses fresh units and removes withdrawn indicators after switching mode and refreshing the index', async () => {
    const heat = { id: 'Heat', label: 'Heat', instance: 'source-b', unit: 'days' };
    const flood = { id: 'Flood', label: 'Flood', instance: 'source-b', unit: 'm' };
    let index = [heat, flood];
    globalThis.fetch = vi.fn(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      if (!url.pathname.endsWith('/api/indicators') && !url.pathname.endsWith('/api/indicators/filters')) throw new Error(`Unexpected request: ${url}`);
      const indicators = url.searchParams.has('region') ? [heat, flood] : index;
      return Response.json({ indicators, failedInstances: [] });
    });
    SELECTION_MODE.set('geography');
    runtimeCatalog.selectGeography('Austria');
    await runtimeCatalog.loadIndicatorIndex();
    render(IndicatorSelection);
    await fireEvent.click(screen.getByRole('button', { name: 'Select an indicator' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Flood' })).toBeTruthy());
    runtimeCatalog.selectIndicator({ id: heat.id, instance: heat.instance });

    SELECTION_MODE.set('indicator');
    await waitFor(() => expect(get(runtimeCatalog.filteredIndicators).status).toBe('idle'));
    index = [{ ...heat, unit: 'hours' }];
    await runtimeCatalog.loadIndicatorIndex({ refresh: true });

    await waitFor(() => expect(get(CURRENT_INDICATOR).unit.uid).toBe('hours'));
    expect(screen.queryByRole('radio', { name: 'Flood' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Heat' })).toBeTruthy();
  });

  test('shows progress beside the filters while a filtered list loads', async () => {
    const heat = { id: 'Heat', label: 'Heat', instance: 'source-b', unit: 'days' };
    const filters = [
      { key: 'Sector', label: 'Sector', color: 'grass', options: [{ value: 'Health', count: 1 }] },
      { key: 'Project', label: 'Project', color: 'pink', options: [{ value: 'PROVIDE', count: 1 }] },
      { key: 'Data Source', label: 'Data Source', color: 'gray', options: [] },
      { key: 'Spatial Resolution', label: 'Spatial Resolution', color: 'orange', options: [] },
      { key: 'Temporal Resolution', label: 'Temporal', color: 'sky', options: [] },
    ];
    let finishRequest;
    const pendingResponse = new Promise((resolve) => { finishRequest = resolve; });
    globalThis.fetch = vi.fn(async (input) => {
      // The component fetches a relative path; give it a base so the mock can
      // read its params instead of throwing on an invalid URL.
      const url = new URL(String(input), 'http://localhost');
      if (!url.pathname.endsWith('/api/indicators') && !url.pathname.endsWith('/api/indicators/filters')) throw new Error(`Unexpected request: ${url}`);
      if (url.searchParams.get('Sector') === 'Health') return pendingResponse;
      return Response.json({ indicators: [heat], failedInstances: [], filters });
    });
    SELECTION_MODE.set('indicator');
    await Promise.all([runtimeCatalog.loadIndicatorIndex(), runtimeCatalog.loadFilterGroups()]);
    render(IndicatorSelection);

    await fireEvent.click(screen.getByRole('button', { name: 'Select an indicator' }));
    await fireEvent.click(screen.getByRole('button', { name: /Advanced Filters/ }));
    for (const { label } of filters) expect(screen.getByText(label)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: /Health/ }));

    expect(get(runtimeCatalog.indicatorFilters)).toEqual({ Sector: ['Health'] });
    expect(get(runtimeCatalog.filteredIndicators).status).toBe('loading');
    expect(get(runtimeCatalog.indicatorIndex).status).toBe('success');
    await waitFor(() => expect(screen.getByText('Updating indicators…')).toBeTruthy());
    finishRequest(Response.json({ indicators: [heat], failedInstances: [], filters }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Heat' })).toBeTruthy());
    for (const { label } of filters) expect(screen.getByText(label)).toBeTruthy();
  });

  test('restores the list when an empty filter is deselected', async () => {
    const heat = { id: 'Heat', label: 'Heat', instance: 'source-b', unit: 'days' };
    const flood = { id: 'Flood', label: 'Flood', instance: 'source-b', unit: 'm' };
    const filters = [{ key: 'Sector', label: 'Sector', color: 'grass', options: [{ value: 'Health', count: 1 }, { value: 'Water', count: 0 }] }];
    const emptyFilters = [{ key: 'Sector', label: 'Sector', color: 'grass', options: [{ value: 'Health', count: 0 }, { value: 'Water', count: 0 }] }];
    let regionRequests = 0;
    globalThis.fetch = vi.fn(async (input) => {
      // The component fetches a relative path; give it a base so the mock can
      // read its params instead of throwing on an invalid URL.
      const url = new URL(String(input), 'http://localhost');
      if (!url.pathname.endsWith('/api/indicators') && !url.pathname.endsWith('/api/indicators/filters')) throw new Error(`Unexpected request: ${url}`);
      if (url.searchParams.get('Sector') === 'Health') return Response.json({ indicators: [], failedInstances: [], filters: emptyFilters });
      if (url.pathname.endsWith('/api/indicators') && url.searchParams.get('region') === 'DEU' && !url.searchParams.has('Sector')) {
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
    await screen.findByRole('button', { name: 'Health 1' });
    expect(screen.queryByRole('button', { name: /Water/ })).toBeNull();
    expect(get(runtimeCatalog.indicatorFilters)).toEqual({});
    await fireEvent.click(screen.getByRole('button', { name: /Health/ }));
    await waitFor(() => expect(screen.getByText('No indicators found.')).toBeTruthy());

    expect(screen.getByRole('button', { name: 'Health 1' }).disabled).toBe(false);
    await fireEvent.click(screen.getByRole('button', { name: 'Health 1' }));
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
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/app\/indicator-details\/flood%2Fdepth\?instance=source-b$/), { signal: expect.any(AbortSignal) });
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/geography-availability\?indicator=flood%2Fdepth&instance=source-b$/), { signal: expect.any(AbortSignal) });
    });
  });
});
