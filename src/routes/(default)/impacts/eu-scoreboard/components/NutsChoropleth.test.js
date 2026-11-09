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

const borderLayer = () => calls.find(([name, layer]) => name === 'addLayer' && layer.id.startsWith('country-choropleth-border-'))[1];

test('keeps country borders hidden while countries carry their own fills', () => {
  render(Fixture, { shape, values, classes });
  expect(borderLayer().layout.visibility).toBe('none');
});

test('outlines only the listed countries over a regional or raster map', () => {
  render(Fixture, { shape, borders: true, borderCountries: ['ITA', 'AUT'] });
  expect(borderLayer().layout.visibility).toBe('visible');
  expect(borderLayer().filter).toEqual(['in', COUNTRY_CODE, ['literal', ['ITA', 'AUT']]]);
});

test('shows, hides and refilters the borders as the map changes', async () => {
  const { component } = render(Fixture, { shape, values, classes });
  const id = borderLayer().id;
  await component.$set({ borders: true, borderCountries: ['ITA'] });
  expect(calls.filter(([name, layer]) => name === 'setLayoutProperty' && layer === id).at(-1)).toEqual(['setLayoutProperty', id, 'visibility', 'visible']);
  expect(calls.filter(([name, layer]) => name === 'setFilter' && layer === id).at(-1)[2]).toEqual(['in', COUNTRY_CODE, ['literal', ['ITA']]]);
  await component.$set({ borders: false });
  expect(calls.filter(([name, layer]) => name === 'setLayoutProperty' && layer === id).at(-1)).toEqual(['setLayoutProperty', id, 'visibility', 'none']);
});
