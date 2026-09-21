// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { rgb } from 'd3-color';
import { readable } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import colors from '$styles/color-tokens-light.json';
import Fixture from './Scenarios.test.fixture.svelte';

vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('https://example.test/methodology/key-terms') }),
}));

const selectedColor = rgb(colors.category.base[0]).formatRgb();

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(240);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('scenario comparison', () => {
  test('uses a table selection in the charts and explorer link', async () => {
    const view = render(Fixture);
    const checkbox = await screen.findByRole('checkbox', { name: /First scenario/ });

    await fireEvent.click(checkbox);

    expect(screen.getByText('View 1 selected scenario in explorer')).toBeTruthy();
    expect(screen.getByRole('gridcell', { name: '0 GtCO₂eq/yr' })).toBeTruthy();
    expect(screen.getByRole('gridcell', { name: '-2 GtCO₂eq/yr' })).toBeTruthy();
    const selectedLines = [...view.container.querySelectorAll('.path-line')].filter((line) => rgb(line.style.stroke)?.formatRgb() === selectedColor && line.getAttribute('d'));
    expect(selectedLines.length).toBe(2);
    expect(selectedLines.some((line) => line.getAttribute('d').match(/M/g)?.length === 2)).toBe(true);

    await fireEvent.click(checkbox);
    expect(screen.getByText('Select scenarios to view them in the explorer')).toBeTruthy();
    expect([...view.container.querySelectorAll('.path-line')].some((line) => rgb(line.style.stroke)?.formatRgb() === selectedColor)).toBe(false);
  });
});
