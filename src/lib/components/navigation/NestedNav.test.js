// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Fixture from './NestedNav.test.fixture.svelte';

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('NestedNav dynamic sections', () => {
  test('tracks headings loaded after the page shell', async () => {
    render(Fixture);

    expect(screen.queryByRole('link', { name: 'Scenario list' })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Load sections' }));

    expect((await screen.findByRole('link', { name: 'Scenario list' })).getAttribute('href')).toBe('#scenario-list');
    expect(screen.getByRole('link', { name: 'Scenario timelines' }).getAttribute('href')).toBe('#scenario-timelines');

    await fireEvent.click(screen.getByRole('button', { name: 'Rename section' }));
    expect((await screen.findByRole('link', { name: 'Scenario catalogue' })).getAttribute('href')).toBe('#scenario-list');

    await fireEvent.click(screen.getByRole('button', { name: 'Remove sections' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Scenario catalogue' })).toBeNull());
  });

  test('drops stale headings when the content element is replaced', async () => {
    render(Fixture);
    await fireEvent.click(screen.getByRole('button', { name: 'Load sections' }));
    expect(await screen.findByRole('link', { name: 'Scenario list' })).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Replace content' }));

    expect((await screen.findByRole('link', { name: 'Replacement section' })).getAttribute('href')).toBe('#replacement-section');
    expect(screen.queryByRole('link', { name: 'Scenario list' })).toBeNull();
  });
});
