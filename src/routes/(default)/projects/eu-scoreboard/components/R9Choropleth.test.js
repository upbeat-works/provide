// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, expect, test } from 'vitest';
import Fixture, { calls } from './R9Choropleth.test.fixture.svelte';
import { numericClasses } from './choropleth.js';

afterEach(() => {
  cleanup();
  calls.length = 0;
});

test('uses the bundled R9 source and clears stale fills when values become empty', async () => {
  const values = [{ uid: 'European Union (R9)', value: 4 }];
  const classes = numericClasses(values);
  const { component } = render(Fixture, { values, classes });
  expect(calls.find(([name]) => name === 'addSource')[2]).toMatchObject({ type: 'geojson', data: '/data/eu-scoreboard/r9_regions.geojson' });
  await component.$set({ values: [] });
  expect(calls.filter(([name]) => name === 'setPaintProperty').at(-1)[3]).toBe('transparent');
  expect(calls.filter(([name]) => name === 'setFilter').at(-1)[2]).toEqual(['in', ['get', 'I_REGION'], ['literal', []]]);
});
