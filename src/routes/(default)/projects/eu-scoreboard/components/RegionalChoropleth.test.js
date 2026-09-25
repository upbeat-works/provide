// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, expect, test } from 'vitest';
import Fixture, { calls } from './RegionalChoropleth.test.fixture.svelte';
import { numericClasses, NUTS_ID } from './choropleth.js';

afterEach(() => {
  cleanup();
  calls.length = 0;
});

const shapeFor = (region) => ({
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: { NUTS_ID: region }, geometry: { type: 'Polygon', coordinates: [] } }],
});

test.each([
  ['NUTS1', 'AT1'],
  ['NUTS2', 'AT11'],
])('joins %s values through NUTS_ID when features have no top-level id', (_, region) => {
  const shape = shapeFor(region);
  const values = [{ region, value: 0 }];
  const classes = numericClasses(values);
  render(Fixture, { shape, values, classes });

  expect(shape.features[0].id).toBeUndefined();
  const source = calls.find(([name]) => name === 'addSource')[2];
  expect(source.data).toBe(shape);
  const fill = calls.find(([name, layer]) => name === 'addLayer' && layer.type === 'fill')[1];
  expect(fill.paint['fill-color']).toEqual(['match', NUTS_ID, region, classes[0].color, 'transparent']);
});

test('updates the source data and clears fills when country or level changes', async () => {
  const shape = shapeFor('AT11');
  const values = [{ region: 'AT11', value: 3 }];
  const classes = numericClasses(values);
  const nextShape = { type: 'FeatureCollection', features: [] };
  const { component } = render(Fixture, { shape, values, classes });

  await component.$set({ shape: nextShape, values: [] });

  expect(calls.some(([name, , data]) => name === 'setData' && data === nextShape)).toBe(true);
  expect(calls.filter(([name]) => name === 'setPaintProperty').at(-1)[3]).toBe('transparent');
});
