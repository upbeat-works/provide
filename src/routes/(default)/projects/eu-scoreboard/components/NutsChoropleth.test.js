// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import Fixture, { calls } from './NutsChoropleth.test.fixture.svelte';
import { numericClasses, COUNTRY_CODE } from './choropleth.js';

afterEach(() => {
  cleanup();
  calls.length = 0;
});

const shape = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { geoId: 'ITA' }, geometry: { type: 'Polygon', coordinates: [] } }] };
const values = [{ uid: 'ITA', value: 4 }];
const classes = numericClasses(values);

test('draws from the geometry it is handed rather than fetching the source again', () => {
  render(Fixture, { shape, values, classes });
  const [, , source] = calls.find(([name]) => name === 'addSource');
  expect(source).toMatchObject({ type: 'geojson', data: shape });
  expect(source.attribution).toContain('EUROSTAT');
});

test('clears stale fills when values become empty', async () => {
  const { component } = render(Fixture, { shape, values, classes });
  await component.$set({ values: [] });
  expect(calls.filter(([name]) => name === 'setPaintProperty').at(-1)[3]).toBe('transparent');
  expect(calls.filter(([name]) => name === 'setFilter').at(-1)[2]).toEqual(['in', COUNTRY_CODE, ['literal', []]]);
});

test('outlines the country the view is scoped to', () => {
  render(Fixture, { shape, values, classes, highlight: 'ITA' });
  const highlightLayer = calls.filter(([name]) => name === 'addLayer').at(-1)[1];
  expect(highlightLayer.filter).toEqual(['in', COUNTRY_CODE, ['literal', ['ITA']]]);
});

test('opens every country in the supplied coverage, including one without a score', async () => {
  const selected = vi.fn();
  const { component } = render(Fixture, { shape, values, classes, selectable: true });
  component.$on('select', ({ detail }) => selected(detail.uid));

  component.fire('click', { features: [{ properties: { geoId: 'ITA' } }] });
  expect(selected).toHaveBeenCalledWith('ITA');

  component.fire('click', { features: [{ properties: { geoId: 'MAR' } }] });
  expect(selected).toHaveBeenCalledWith('MAR');
});

test('promises a click only where one is handled', async () => {
  const { component } = render(Fixture, { shape, values, classes, selectable: false });
  component.fire('mousemove', { features: [{ properties: { geoId: 'ITA' } }] });
  expect(component.cursor()).toBe('');
});
