import { interpolateLab, piecewise } from 'd3-interpolate';

export function colorScenarios(scenarios, colors) {
  return scenarios.map((scenario, index) => ({
    ...scenario,
    color: colors.base[index],
    colorInterpolator: piecewise(interpolateLab, [colors.weakest[index], colors.base[index], colors.strongest[index]]),
  }));
}
