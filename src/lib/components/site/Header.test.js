// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import Fixture from './Header.test.fixture.svelte';

vi.mock('$stores/state.js', async () => {
  const { writable } = await import('svelte/store');
  return { HEADER_CLASS: writable('') };
});
vi.mock('$utils/url.js', () => ({ checkCurrentLink: (href, page) => page?.url?.pathname?.startsWith(href) }));

afterEach(cleanup);

test('opens the EU Scoreboard from Tools', async () => {
  render(Fixture);
  await fireEvent.click(screen.getByRole('button', { name: 'Tools' }));

  expect((await screen.findByRole('menuitem', { name: 'EU Scoreboard' })).getAttribute('href')).toBe('/impacts/eu-scoreboard');
});
