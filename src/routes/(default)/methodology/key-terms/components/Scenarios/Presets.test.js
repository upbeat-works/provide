// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'vitest';
import Fixture from './Presets.test.fixture.svelte';

afterEach(cleanup);

describe('scenario presets', () => {
  test('applies and clears a preset', async () => {
    render(Fixture);
    const preset = screen.getByRole('button', { name: /First preset/ });

    await fireEvent.click(preset);
    expect(screen.getByRole('status').textContent).toBe('one');

    await fireEvent.click(preset);
    expect(screen.getByRole('status').textContent).toBe('');
  });

  test('keeps a manual scenario selection after a preset was active', async () => {
    render(Fixture);

    await fireEvent.click(screen.getByRole('button', { name: /First preset/ }));
    expect(screen.getByRole('status').textContent).toBe('one');

    await fireEvent.click(screen.getByRole('button', { name: 'Select second scenario' }));

    expect(screen.getByRole('status').textContent).toBe('two');
  });
});
