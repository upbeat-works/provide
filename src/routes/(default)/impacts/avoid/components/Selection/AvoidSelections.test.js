// @vitest-environment jsdom

import { writable, get } from 'svelte/store';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { avoidMeta } = vi.hoisted(() => ({ avoidMeta: {
  cities: [
    { uid: 'lisbon', label: 'Lisbon', group: 'Portugal' },
    { uid: 'madrid', label: 'Madrid', group: 'Spain' },
  ],
  indicators: [
    { uid: 'urbclim-heatwave-days', label: 'Heatwave Days per Year', sector: 'heat', availableGeographies: ['lisbon', 'madrid'] },
    { uid: 'urbclim-cooling-degree-hours', label: 'Cooling Degree Hours', sector: 'heat', availableGeographies: ['lisbon', 'madrid'] },
  ],
  sectors: [{ uid: 'heat', label: 'Heat' }],
} }));

vi.mock('$app/stores', () => ({ page: writable({ data: { avoidMeta } }) }));

import AvoidGeographySelection from './AvoidGeographySelection.svelte';
import AvoidIndicatorSelection from './AvoidIndicatorSelection.svelte';
import { AVOID_CITY_UID, AVOID_INDICATOR_UID, AVOID_INSTANCE } from '$stores/avoid-catalog.js';

const nativeFetch = globalThis.fetch;
const emptyShapes = { data: { type: 'FeatureCollection', features: [] } };

beforeEach(() => {
  HTMLElement.prototype.scrollTo = vi.fn();
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.fetch = vi.fn(async (input) => {
    if (String(input).includes('/geo-shape/')) return Response.json(emptyShapes);
    throw new Error(`Unexpected request: ${input}`);
  });
  AVOID_CITY_UID.set(undefined);
  AVOID_INDICATOR_UID.set(undefined);
  AVOID_INSTANCE.set(undefined);
});

afterEach(() => {
  cleanup();
  globalThis.fetch = nativeFetch;
  vi.restoreAllMocks();
});

describe('Avoid selectors', () => {
  test('stages a city until Apply and discards a closed first selection', async () => {
    render(AvoidGeographySelection);

    await fireEvent.click(screen.getByRole('button', { name: 'Select a city' }));
    await fireEvent.click(screen.getByRole('radio', { name: 'Lisbon' }));
    expect(get(AVOID_CITY_UID)).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(get(AVOID_CITY_UID)).toBeUndefined();

    await fireEvent.click(screen.getByRole('button', { name: 'Select a city' }));
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    await fireEvent.click(screen.getByRole('radio', { name: 'Lisbon' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(get(AVOID_CITY_UID)).toBe('Lisbon'));
  });

  test('applies the canonical indicator and its source only after confirmation', async () => {
    AVOID_CITY_UID.set('Lisbon');
    render(AvoidIndicatorSelection);

    await fireEvent.click(screen.getByRole('button', { name: 'Select an indicator' }));
    await fireEvent.click(screen.getByRole('radio', { name: 'Heatwave Days per Year' }));
    expect(get(AVOID_INDICATOR_UID)).toBeUndefined();
    expect(get(AVOID_INSTANCE)).toBeUndefined();

    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => {
      expect(get(AVOID_INDICATOR_UID)).toBe('Heatwave Days per Year');
      expect(get(AVOID_INSTANCE)).toBe('provide-internal');
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Heatwave Days per Year' }));
    await fireEvent.click(screen.getByRole('radio', { name: 'Cooling Degree Hours' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(get(AVOID_INDICATOR_UID)).toBe('Heatwave Days per Year');
    expect(get(AVOID_INSTANCE)).toBe('provide-internal');
  });
});
