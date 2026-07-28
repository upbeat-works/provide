/**
 * Resolve the colour of an impact-time line segment from its warming-level step.
 *
 * The step is only defined for scenarios the climate emulator has a global-mean-
 * temperature trajectory for. A scenario without one — a name the impact model and
 * the emulator spell differently, or the year-2000 `Today` baseline — carries
 * `step === undefined`, and d3's `piecewise` indexes its interpolator array with
 * that step (`I[Math.floor(t * n)]`), so passing it through throws
 * "I[i] is not a function" and takes the whole chart down. Fall back to the
 * scenario's flat colour instead: uncoloured by warming level, still drawn.
 */
export function colorForStep(interpolator, step, fallback) {
  if (typeof interpolator !== 'function' || !Number.isFinite(step)) return fallback;
  return interpolator(step);
}
