// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import LayerInfoModal from './LayerInfoModal.svelte';

// The headless Dialog watches its portal root, which needs an observer jsdom
// does not implement.
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

const props = {
  isOpen: true,
  title: 'High Heat Risk',
  parts: [{ label: 'Austria' }, { label: 'CurrentPolicies' }],
  rows: [{ label: 'Unit', value: 'days/yr' }],
};

// The backdrop is covered edge to edge by the scrolling container, so a click
// outside the panel lands on that container rather than on DialogOverlay.
const backdrop = () => screen.getByText('High Heat Risk').closest('.overflow-y-auto');

test('shows the layer title, selection and rows while open', () => {
  render(LayerInfoModal, props);
  expect(screen.getByText('High Heat Risk')).toBeTruthy();
  expect(screen.getByText('Unit')).toBeTruthy();
  expect(screen.getByText('days/yr')).toBeTruthy();
  expect(screen.getByText(/Austria/)).toBeTruthy();
});

test('closes on a click outside the panel', async () => {
  render(LayerInfoModal, props);
  await fireEvent.click(backdrop());
  expect(screen.queryByText('High Heat Risk')).toBeNull();
});

test('stays open when the click is inside the panel', async () => {
  render(LayerInfoModal, props);
  await fireEvent.click(screen.getByText('Unit'));
  expect(screen.getByText('High Heat Risk')).toBeTruthy();
});

test('closes on the close button', async () => {
  render(LayerInfoModal, props);
  await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByText('High Heat Risk')).toBeNull();
});
