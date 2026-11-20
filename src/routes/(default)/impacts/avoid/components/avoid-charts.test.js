import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { writable } from 'svelte/store';
import { afterEach, expect, test, vi } from 'vitest';
import theme from '$styles/theme-store.js';
import ThresholdLevels from './ThresholdLevels/ThresholdLevels.svelte';
import StudyLocations from './StudyLocations/StudyLocations.svelte';

vi.mock('./ThresholdLevels/Text.svelte', () => import('../../eu-scoreboard/components/Empty.test.fixture.svelte'));
vi.mock('./StudyLocations/Map.svelte', () => import('../../eu-scoreboard/components/Empty.test.fixture.svelte'));
vi.mock('$app/stores', () => ({ page: writable({ url: new URL('http://localhost/impacts/avoid'), data: {} }) }));

afterEach(cleanup);

test.each([
  ['When will your impact level be exceeded?', ThresholdLevels],
  ['How does this vary across the urban environment?', StudyLocations],
])('shows %s when the shared Avoid request succeeds', async (heading, Chart) => {
  theme.set({ color: { category: { base: ['#123', '#234', '#345'], weakest: ['#abc', '#bcd', '#cde'] } } });
  const store = writable({ status: 'loading' });
  render(Chart, { store, tagline: 'Avoid' });
  expect(screen.queryByRole('heading', { name: heading })).toBeNull();

  store.set({ status: 'success', data: { study_locations: {} } });
  await tick();

  expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
});
