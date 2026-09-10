// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import IndicatorSelection from './IndicatorSelection.svelte';
import { runtimeCatalog } from '$stores/runtime-catalog.js';

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
  globalThis.fetch = nativeFetch;
  cleanup();
  vi.restoreAllMocks();
});

describe('IndicatorSelection', () => {
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
