import { describe, test, expect } from 'bun:test';
import { piecewise, interpolateLab } from 'd3-interpolate';
import { colorForStep } from './gmt-color.js';

// The real interpolator the scenario stores build (state.js CURRENT_SCENARIOS).
const interpolator = piecewise(interpolateLab, ['#eee', '#888', '#111']);
const FALLBACK = '#ff0000';

describe('colorForStep', () => {
  test('colours a segment by its warming-level step', () => {
    expect(colorForStep(interpolator, 0.5, FALLBACK)).toBe(interpolator(0.5));
  });

  // A scenario the emulator has no trajectory for (a name the models spell
  // differently, or the year-2000 `Today` baseline) carries step === undefined.
  // d3's piecewise indexes its interpolator array with the step, so passing it
  // through throws "I[i] is not a function" and takes the whole chart down.
  test('falls back to the scenario colour when the scenario has no GMT', () => {
    expect(colorForStep(interpolator, undefined, FALLBACK)).toBe(FALLBACK);
  });

  test('falls back on a NaN step rather than throwing', () => {
    expect(colorForStep(interpolator, NaN, FALLBACK)).toBe(FALLBACK);
  });

  test('survives a missing interpolator', () => {
    expect(colorForStep(undefined, 0.5, FALLBACK)).toBe(FALLBACK);
  });

  test('treats step 0 as a real value, not as missing', () => {
    expect(colorForStep(interpolator, 0, FALLBACK)).toBe(interpolator(0));
  });
});
