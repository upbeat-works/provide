// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, expect, test } from 'vitest';
import SeriesPicker from './SeriesPicker.test.fixture.svelte';
import { defaultSelection } from './series-filter.js';

afterEach(cleanup);

const countries = ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece'];
const groups = countries.map((uid) => ({ uid, label: uid }));
const mount = (overrides = {}) => render(SeriesPicker, { groups, selected: defaultSelection(groups), ...overrides });

const box = (name) => screen.getByRole('checkbox', { name });

test('shows one page of ten and captions the range', () => {
  mount();
  expect(screen.getByText('1–10 of 12')).toBeTruthy();
  expect(screen.getAllByRole('checkbox')).toHaveLength(10);
  expect(screen.queryByText('Germany')).toBeNull();
});

test('opens with the first page checked, so the chart matches what is shown', () => {
  mount();
  expect(screen.getAllByRole('checkbox').every((input) => input.checked)).toBe(true);
});

test('pages forward to the remainder and back again', async () => {
  mount();
  await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByText('11–12 of 12')).toBeTruthy();
  expect(screen.getByText('Germany')).toBeTruthy();
  // Page two is past the default ten, so neither is selected.
  expect(screen.getAllByRole('checkbox').some((input) => input.checked)).toBe(false);

  await fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
  expect(screen.getByText('1–10 of 12')).toBeTruthy();
});

test('stops at either end rather than wrapping', async () => {
  mount();
  expect(screen.getByRole('button', { name: 'Previous page' }).disabled).toBe(true);
  await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByRole('button', { name: 'Next page' }).disabled).toBe(true);
});

const selection = () => screen.getByTestId('selected').textContent.split(',').filter(Boolean);

test('unchecking a country leaves the rest alone, and tells the parent', async () => {
  mount();
  await fireEvent.click(box('Austria'));
  expect(selection()).not.toContain('Austria');
  expect(selection()).toContain('Belgium');
  expect(box('Austria').checked).toBe(false);
  expect(box('Belgium').checked).toBe(true);
});

test('rechecking a country puts it back', async () => {
  mount();
  await fireEvent.click(box('Austria'));
  await fireEvent.click(box('Austria'));
  expect(selection()).toContain('Austria');
  expect(box('Austria').checked).toBe(true);
});

test('clearing empties the selection and hides the clear control', async () => {
  mount();
  await fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(selection()).toEqual([]);
  expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
  expect(screen.getAllByRole('checkbox').some((input) => input.checked)).toBe(false);
});

test('paints a checked box in the colour its chart draws', () => {
  mount({ colors: { Austria: 'rgb(78,121,167)' } });
  expect(box('Austria').getAttribute('style')).toContain('rgb(78,121,167)');
  // No colour for Belgium, so its box must not borrow Austria's.
  expect(box('Belgium').getAttribute('style') ?? '').not.toContain('rgb(78,121,167)');
});

test('drops the pager when everything fits on one page', () => {
  render(SeriesPicker, { groups: groups.slice(0, 4), selected: [] });
  expect(screen.getByText('1–4 of 4')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
});
