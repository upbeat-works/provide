import { describe, expect, test } from 'vitest';
import { calculateDifference } from './geo.js';

const grid = (data, overrides = {}) => ({ data: { data, coordinatesOrigin: [1, 2], resolution: 0.5, unit: '°C', ...overrides } });

test('subtracts compatible cells and keeps a missing value from either grid', () => {
  expect(calculateDifference([grid([[1, null], [3, 4]]), grid([[2, 3], [null, 8]])]).data).toEqual([[1, null], [null, 4]]);
});

test.each([
  { coordinatesOrigin: [2, 2] },
  { resolution: 1 },
  { unit: 'K' },
  { data: [[1]] },
])('rejects grids with incompatible geometry or units', (overrides) => {
  const secondData = overrides.data ?? [[2, 3], [4, 5]];
  expect(() => calculateDifference([grid([[1, 2], [3, 4]]), grid(secondData, overrides)])).toThrow('Map grids cannot be compared');
});
