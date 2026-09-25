// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import GeographySelection from './GeographySelection.svelte';
import { runtimeCatalog } from '$stores/runtime-catalog.js';

const nativeFetch = globalThis.fetch;
const nativeScrollIntoView = HTMLElement.prototype.scrollIntoView;
const geographies = [
  { id: 'Africa', label: 'Africa', geographyType: 'continents', parents: [] },
  { id: 'Algeria', label: 'Algeria', geoId: 'DZA', geographyType: 'admin0', parents: ['Africa'] },
  { id: 'Afghanistan', label: 'Afghanistan', geoId: 'AFG', geographyType: 'admin0', parents: ['Africa'] },
  { id: 'Kabul', label: 'Kabul', geographyType: 'cities', parents: ['Afghanistan'] },
  { id: 'Herat', label: 'Herat', geographyType: 'cities', parents: ['Afghanistan'] },
  { id: 'Europe', label: 'Europe', geographyType: 'continents', parents: [] },
  { id: 'Germany', label: 'Germany', geoId: 'DEU', geographyType: 'admin0', parents: ['Europe'] },
];
const geographyTypes = [
  { id: 'admin0', label: 'Countries', labelSingular: 'Country', isSelectable: true },
  { id: 'cities', label: 'Cities', labelSingular: 'City', isSelectable: true },
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
  HTMLElement.prototype.scrollIntoView = nativeScrollIntoView;
  cleanup();
  vi.restoreAllMocks();
});

describe('GeographySelection', () => {
  test('scrolls to the selected country each time the selector opens', async () => {
    const scrolled = [];
    HTMLElement.prototype.scrollIntoView = vi.fn(function () { scrolled.push(this); });
    render(GeographySelection);

    await fireEvent.click(screen.getByRole('button', { name: /Algeria/ }));
    await waitFor(() => expect(scrolled).toContain(screen.getByRole('radio', { name: /Algeria/ })));

    await fireEvent.click(screen.getByRole('button', { name: 'Collapse Africa' }));
    await fireEvent.input(screen.getByPlaceholderText('Search geography'), { target: { value: 'Germany' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.click(screen.getByRole('button', { name: /Algeria/ }));
    await waitFor(() => expect(scrolled).toHaveLength(2));
    expect(scrolled[1]).toBe(screen.getByRole('radio', { name: /Algeria/ }));
  });

  test('opens the selected city branch and scrolls to its row', async () => {
    const scrolled = [];
    HTMLElement.prototype.scrollIntoView = vi.fn(function () { scrolled.push(this); });
    runtimeCatalog.selectGeography('Kabul');
    render(GeographySelection);

    await fireEvent.click(screen.getByRole('button', { name: /Kabul/ }));
    await waitFor(() => expect(scrolled).toContain(screen.getByRole('radio', { name: /Kabul/ })));
    expect(screen.getByRole('button', { name: 'Collapse Afghanistan' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Cities/ }).getAttribute('aria-expanded')).toBe('true');
  });

  test('shows leaf counts on expandable continent and country rows', async () => {
    render(GeographySelection);

    await fireEvent.click(screen.getByRole('button', { name: /Algeria/ }));

    expect(within(screen.getByRole('button', { name: 'Collapse Africa' })).getByText('3')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: 'Expand Afghanistan' })).getByText('2')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: 'Collapse Europe' })).getByText('1')).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Expand Afghanistan' }));
    expect(within(screen.getByRole('button', { name: /Cities/ })).getByText('2')).toBeTruthy();
  });

  test('collapses one continent while keeping the others open', async () => {
    render(GeographySelection);

    await fireEvent.click(screen.getByRole('button', { name: /Algeria/ }));
    expect(screen.getByRole('radio', { name: /Afghanistan/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Germany/ })).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Collapse Africa' }));
    expect(screen.queryByRole('radio', { name: /Afghanistan/ })).toBeNull();
    expect(screen.getByRole('radio', { name: /Germany/ })).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Expand Africa' }));
    expect(screen.getByRole('radio', { name: /Afghanistan/ })).toBeTruthy();
  });

  test('lets a user reach a city under a country found through search', async () => {
    render(GeographySelection);

    await fireEvent.click(screen.getByRole('button', { name: /Algeria/ }));
    await fireEvent.input(screen.getByPlaceholderText('Search geography'), { target: { value: 'Afghanistan' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Expand Afghanistan' }));
    await fireEvent.click(screen.getByRole('button', { name: /Cities/ }));
    await fireEvent.click(screen.getByRole('radio', { name: /Kabul/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(get(runtimeCatalog.selection).geography).toBe('Kabul'));
  });

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
