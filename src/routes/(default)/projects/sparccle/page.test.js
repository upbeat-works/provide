// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import Page from './+page.svelte';

vi.mock('../../landing-page/sections/SectionExplore.svelte', () => import('../../impacts/eu-scoreboard/components/Empty.test.fixture.svelte'));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('opens the EU Scoreboard tool from the SPARCCLE project page', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  render(Page, { data: { caseStudies: [], projectSection: null } });

  expect(screen.getByRole('heading', { level: 1, name: /SPARCCLE/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /EU Scoreboard/ }).getAttribute('href')).toBe('/impacts/eu-scoreboard');
});
