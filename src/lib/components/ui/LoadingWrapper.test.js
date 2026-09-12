// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'vitest';
import Fixture from './LoadingWrapper.test.fixture.svelte';

afterEach(cleanup);

describe('LoadingWrapper', () => {
  test('reports the initial load', () => {
    const view = render(Fixture, { request: { status: 'loading' } });

    expect(screen.getByRole('status').textContent).toContain('Loading data');
    expect(view.container.firstElementChild.getAttribute('aria-busy')).toBe('true');
  });

  test('shows the same loading state during a refresh', async () => {
    const view = render(Fixture, { request: { status: 'success', data: { label: 'Existing chart' } } });

    await view.rerender({ request: { status: 'loading' } });

    expect(screen.queryByText('Existing chart')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Loading data');
    expect(view.container.firstElementChild.getAttribute('aria-busy')).toBe('true');

    await view.rerender({ request: { status: 'success', data: { label: 'Updated chart' } } });

    expect(screen.getByText('Updated chart')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(view.container.firstElementChild.getAttribute('aria-busy')).toBe('false');
  });

  test('replaces stale content with clear failure feedback', async () => {
    const view = render(Fixture, { request: { status: 'success', data: { label: 'Existing chart' } } });

    await view.rerender({ request: { status: 'failed', message: 'Request timed out' } });

    expect(screen.queryByText('Existing chart')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Data could not be loaded for this graph');
    expect(screen.getByRole('alert').textContent).toContain('Try again in a moment.');
    expect(screen.getByRole('alert').textContent).not.toContain('data is not available for this selection');
    expect(view.container.firstElementChild.getAttribute('aria-busy')).toBe('false');
  });
});
