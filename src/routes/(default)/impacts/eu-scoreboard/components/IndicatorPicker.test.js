import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import IndicatorPicker from './IndicatorPicker.svelte';
import { getScoreboard } from '../../../../../../api/scoreboard/controller.js';
import { createScoreboardOptions } from '../selection.js';

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function propsFor(topic) {
  const scoreboard = getScoreboard(topic);
  const { indicators } = createScoreboardOptions(scoreboard);
  return { selected: indicators[0], topics: scoreboard.sectors, topic: scoreboard.sector };
}

test('stages a topic and indicator together until Apply', async () => {
  const { component } = render(IndicatorPicker, propsFor('testing'));
  const change = vi.fn();
  component.$on('change', change);

  await fireEvent.click(screen.getByRole('button', { name: /^Indicator:/ }));
  await fireEvent.click(screen.getByRole('button', { name: /^Socioeconomic/ }));
  await fireEvent.click(screen.getByRole('radio', { name: 'Heat wave fatalities' }));
  expect(screen.getByRole('heading', { name: 'Heat wave fatalities' })).toBeTruthy();
  expect(screen.queryByRole('radio', { name: 'Maximum Air Temperature' })).toBeNull();
  expect(change).not.toHaveBeenCalled();
  await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(change).toHaveBeenCalledOnce();
  expect(change.mock.calls[0][0].detail).toMatchObject({
    topic: { uid: 'socioeconomic' },
    indicator: { uid: 'Heat wave fatalities' },
  });
});

test('searches the chosen topic without applying or losing the search when switching topics', async () => {
  const { component } = render(IndicatorPicker, propsFor('testing'));
  const change = vi.fn();
  component.$on('change', change);

  await fireEvent.click(screen.getByRole('button', { name: /^Indicator:/ }));
  await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'fatalities' } });
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  await fireEvent.click(screen.getByRole('button', { name: /^Socioeconomic/ }));

  expect(screen.getByRole('searchbox').value).toBe('fatalities');
  expect(screen.getByRole('radio', { name: 'Heat wave fatalities' })).toBeTruthy();
  expect(change).not.toHaveBeenCalled();
});

test('previews and applies the indicator chosen with the keyboard', async () => {
  const user = userEvent.setup();
  const props = propsFor('testing');
  const { component } = render(IndicatorPicker, props);
  const change = vi.fn();
  component.$on('change', change);

  await user.click(screen.getByRole('button', { name: /^Indicator:/ }));
  screen.getByRole('radio', { name: 'Maximum Air Temperature' }).focus();
  await user.keyboard('{ArrowDown}');

  const next = screen.getByRole('radio', { name: 'Mean Air Temperature' });
  expect(document.activeElement).toBe(next);
  expect(screen.getByRole('heading', { name: 'Mean Air Temperature' })).toBeTruthy();
  expect(next.getAttribute('aria-checked')).toBe('true');
  expect(change).not.toHaveBeenCalled();

  await user.tab();
  await user.keyboard('{Enter}');
  expect(change).toHaveBeenCalledOnce();
  expect(change.mock.calls[0][0].detail).toEqual({
    topic: { uid: 'testing', label: 'Testing' },
    indicator: { uid: 'Mean Air Temperature', label: 'Mean Air Temperature' },
  });
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('shows the current indicator details after the topic changes', async () => {
  const { rerender } = render(IndicatorPicker, propsFor('testing'));
  await fireEvent.click(screen.getByRole('button', { name: /^Indicator:/ }));
  const preview = screen.getByRole('radio', { name: 'Mean Air Temperature' });
  await fireEvent.mouseOver(within(preview).getByText('Mean Air Temperature'));
  expect(screen.getByRole('heading', { name: 'Mean Air Temperature' })).toBeTruthy();
  await fireEvent.click(screen.getByRole('button', { name: 'Close' }));

  const props = propsFor('socioeconomic');
  await rerender(props);
  await fireEvent.click(screen.getByRole('button', { name: /^Indicator:/ }));

  expect(screen.getByRole('heading', { name: props.selected.label })).toBeTruthy();
  expect(screen.getByText('NUTS-2 regions')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Mean Air Temperature' })).toBeNull();
});

test('discards the topic and indicator when the dialog closes without Apply', async () => {
  const { component } = render(IndicatorPicker, propsFor('testing'));
  const change = vi.fn();
  component.$on('change', change);

  await fireEvent.click(screen.getByRole('button', { name: /^Indicator:/ }));
  await fireEvent.click(screen.getByRole('button', { name: /^Socioeconomic/ }));
  await fireEvent.click(screen.getByRole('radio', { name: 'Heat wave fatalities' }));
  expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
  await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await fireEvent.click(screen.getByRole('button', { name: /^Indicator:/ }));

  expect(screen.getByRole('radio', { name: 'Maximum Air Temperature' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByRole('button', { name: /^Testing/ }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  expect(change).not.toHaveBeenCalled();
});

test('applies a topic without a map indicator', async () => {
  const props = propsFor('testing');
  props.topics = [...props.topics, { uid: 'charts-only', label: 'Charts only', indicators: [] }];
  const { component } = render(IndicatorPicker, props);
  const change = vi.fn();
  component.$on('change', change);

  await fireEvent.click(screen.getByRole('button', { name: /^Indicator:/ }));
  await fireEvent.click(screen.getByRole('button', { name: /^Charts only/ }));
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  expect(change).not.toHaveBeenCalled();
  await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(change.mock.calls[0][0].detail).toEqual({ topic: { uid: 'charts-only', label: 'Charts only' }, indicator: undefined });
});
