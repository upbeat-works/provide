// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, expect, test } from 'vitest';
import Fixture, { calls, emit, events } from './RegionalChoropleth.test.fixture.svelte';
import { numericClasses, NUTS_ID } from './choropleth.js';

afterEach(() => {
  cleanup();
  calls.length = 0;
  events.clear();
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
  const classes = numericClasses(values, 'K');
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

test('shows the region name and current value on hover, including zero', async () => {
  const shape = shapeFor('AT11');
  shape.features[0].properties.NAME_LATN = 'Burgenland';
  const values = [{ region: 'AT11', value: 0 }];
  const { component } = render(Fixture, { shape, values, classes: numericClasses(values, 'people'), unit: 'people' });

  await act(() => emit('mousemove', { features: [shape.features[0]], point: { x: 120, y: 80 } }));
  expect(screen.getByRole('tooltip').textContent).toContain('Burgenland');
  expect(screen.getByRole('tooltip').textContent).toContain('0 people');

  const updated = [{ region: 'AT11', value: 2.5 }];
  await component.$set({ values: updated, classes: numericClasses(updated, 'people') });
  expect(screen.getByRole('tooltip').textContent).toContain('2.5 people');

  await act(() => emit('mouseleave'));
  expect(screen.queryByRole('tooltip')).toBeNull();

  await act(() => emit('click', { features: [shape.features[0]], point: { x: 120, y: 80 } }));
  expect(screen.getByRole('tooltip').textContent).toContain('Burgenland');
});

test('hides the tooltip for regions without a value', async () => {
  const shape = shapeFor('AT11');
  render(Fixture, { shape, values: [], classes: [] });

  await act(() => emit('mousemove', { features: [shape.features[0]], point: { x: 120, y: 80 } }));
  expect(screen.queryByRole('tooltip')).toBeNull();
});
