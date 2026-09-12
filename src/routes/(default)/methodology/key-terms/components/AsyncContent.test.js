// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'vitest';
import Fixture from './AsyncContent.test.fixture.svelte';

afterEach(cleanup);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('AsyncContent', () => {
  test('shows feedback until content is ready', async () => {
    const request = deferred();
    render(Fixture, { promise: request.promise });

    expect(screen.getByRole('status').textContent).toContain('Loading data');
    expect(screen.queryByText('Key terms loaded')).toBeNull();

    request.resolve({ label: 'Key terms loaded' });

    expect(await screen.findByText('Key terms loaded')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('shows clear feedback when content cannot load', async () => {
    const request = deferred();
    render(Fixture, { promise: request.promise });

    request.reject(new Error('network failed'));

    expect((await screen.findByRole('alert')).textContent).toContain('Content could not be loaded');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
