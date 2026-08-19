import { describe, expect, test } from 'bun:test';
import { color } from 'd3-color';
import { COLOR_SCALES } from '$src/config.js';
import { getColorScale } from './geo.js';

const hex = (value) => color(value).formatHex();

describe('getColorScale', () => {
  test('maps the low and high ends of positive data to the configured palette order', () => {
      const scale = getColorScale([[[1, 3]]], COLOR_SCALES.default, -1);

    expect(hex(scale(1))).toBe(hex(COLOR_SCALES.default.POSITIVE_RANGE[0]));
    expect(hex(scale(3))).toBe(hex(COLOR_SCALES.default.POSITIVE_RANGE[1]));
  });
});
