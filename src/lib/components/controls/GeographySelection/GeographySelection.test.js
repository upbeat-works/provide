// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import GeographySelection from './GeographySelection.svelte';
import { runtimeCatalog } from '$stores/runtime-catalog.js';

const nativeFetch = globalThis.fetch;
const geographies = [
  { id: 'Africa', label: 'Africa', geographyType: 'continents', parents: [] },
  { id: 'Algeria', label: 'Algeria', geoId: 'DZA', geographyType: 'admin0', parents: ['Africa'] },
  { id: 'Afghanistan', label: 'Afghanistan', geoId: 'AFG', geographyType: 'admin0', parents: ['Africa'] },
];
const geographyTypes = [
  { id: 'admin0', label: 'Countries', labelSingular: 'Country', isSelectable: true },
  { id: 'continents', label: 'Continents', labelSingular: 'Continent', isSelectable: false },
];
const emptyShapes = { data: { type: 'FeatureCollection', features: [] } };

beforeEach(async () => {
  HTMLElement.prototype.scrollTo = vi.fn();
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.fetch = vi.fn(async (input) => {
    const url = String(input);
    if (url.endsWith('/api/geographies')) return Response.json(geographies);
    if (url.endsWith('/api/geographies/types')) return Response.json(geographyTypes);
    if (url.includes('/geo-shape/')) return Response.json(emptyShapes);
    throw new Error(`Unexpected request: ${url}`);
  });
  runtimeCatalog.selectGeography('Algeria');
  await runtimeCatalog.loadGeographyIndex();
});

afterEach(() => {
  runtimeCatalog.selectGeography(undefined);
  globalThis.fetch = nativeFetch;
  cleanup();
  vi.restoreAllMocks();
});

describe('GeographySelection', () => {
  test('keeps browsing local until Apply and discards a closed draft', async () => {
    render(GeographySelection);

    await fireEvent.click(screen.getByRole('button', { name: /Algeria/ }));
    await fireEvent.click(screen.getByRole('radio', { name: /Afghanistan/ }));

    expect(get(runtimeCatalog.selection).geography).toBe('Algeria');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
    expect(screen.getByText('Afghanistan', { selector: 'span.font-medium' })).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(get(runtimeCatalog.selection).geography).toBe('Algeria');

    await fireEvent.click(screen.getByRole('button', { name: /Algeria/ }));
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    await fireEvent.click(screen.getByRole('radio', { name: /Afghanistan/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(get(runtimeCatalog.selection).geography).toBe('Afghanistan');
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
