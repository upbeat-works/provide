import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import AdvancedFilters from './AdvancedFilters.svelte';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('loads options on opening, allows retry, and keeps loaded options when reopened', async () => {
  let attempts = 0;
  const requestFetch = vi.fn(async (input) => {
    expect(new URL(String(input), 'http://localhost').pathname).toBe('/api/indicators/filters');
    attempts++;
    if (attempts === 1) return Response.json({ error: 'Offline' }, { status: 503 });
    return Response.json({ filters: [{ key: 'Sector', label: 'Sector', options: [{ value: 'Health', count: 1 }] }], failedInstances: [] });
  });
  vi.stubGlobal('fetch', requestFetch);
  render(AdvancedFilters);
  expect(requestFetch).not.toHaveBeenCalled();
  await fireEvent.click(screen.getByRole('button', { name: /Advanced Filters/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Retry advanced filters' })).toBeTruthy());
  await fireEvent.click(screen.getByRole('button', { name: 'Retry advanced filters' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Health/ })).toBeTruthy());
  await fireEvent.click(screen.getByRole('button', { name: /Advanced Filters/ }));
  await fireEvent.click(screen.getByRole('button', { name: /Advanced Filters/ }));
  expect(screen.getByRole('button', { name: /Health/ })).toBeTruthy();
  expect(requestFetch).toHaveBeenCalledTimes(2);
});
