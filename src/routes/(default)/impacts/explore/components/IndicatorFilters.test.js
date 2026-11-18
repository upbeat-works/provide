import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import { tick } from 'svelte';
import { runtimeCatalog } from '$stores/runtime-catalog.js';
import IndicatorFilters from './IndicatorFilters.svelte';

afterEach(() => {
  cleanup();
  runtimeCatalog.selectIndicator(undefined);
  vi.unstubAllGlobals();
});

test('shows fixed parameter values and allows changes only where choices exist', async () => {
  const instance = 'provide-internal';
  const references = ['2011-2020 (Present Day)', '1850-1900 (Pre-industrial)'];
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const url = new URL(input, 'https://example.test');
    const id = decodeURIComponent(url.pathname.split('/').at(-1));
    const times = id === 'Annual heat' ? ['Annual'] : ['Annual', 'June - August'];
    const parameter = (id, label, values) => ({ id, label, options: values.map((value) => ({ id: value, label: value })) });
    return Response.json({
      id, instance,
      parameters: [parameter('time', 'Time', times), parameter('reference', 'Reference', references), parameter('spatial', 'Spatial', ['Area'])],
    });
  }));
  runtimeCatalog.selectGeography(undefined);
  runtimeCatalog.selectIndicator({ id: 'Annual heat', instance });
  await runtimeCatalog.loadIndicatorDetails();
  render(IndicatorFilters);

  const time = screen.getByRole('combobox', { name: 'Time' });
  const spatial = screen.getByRole('combobox', { name: 'Spatial' });
  expect(time.value).toBe('Annual');
  expect(time.disabled).toBe(true);
  expect(spatial.value).toBe('Area');
  expect(spatial.disabled).toBe(true);

  const reference = screen.getByRole('combobox', { name: 'Reference' });
  expect(reference.disabled).toBe(false);
  await fireEvent.change(reference, { target: { value: references[1] } });
  expect(get(runtimeCatalog.selection).parameters).toEqual({ time: 'Annual', reference: references[1], spatial: 'Area' });

  runtimeCatalog.selectIndicator({ id: 'Seasonal heat', instance });
  await runtimeCatalog.loadIndicatorDetails();
  await tick();
  const seasonalTime = screen.getByRole('combobox', { name: 'Time' });
  expect(seasonalTime.disabled).toBe(false);
  await fireEvent.change(seasonalTime, { target: { value: 'June - August' } });
  expect(get(runtimeCatalog.selection).parameters.time).toBe('June - August');
});
