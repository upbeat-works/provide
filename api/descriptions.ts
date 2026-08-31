import { parseVariable } from './conventions';

/**
 * Indicator descriptions, from the per-variable docs ixmp4 stores. Every
 * variable of an indicator carries the same prose, so the indicator's
 * description is any one of them.
 */

/**
 * Drop the machine-appended unit marker ixmp4 puts at the end of a variable's
 * docs (`… expressed in degrees Celsius (°C). [°C]`). The unit is rendered
 * separately, and it differs per variable while the prose does not.
 */
export function stripUnitSuffix(description: string): string {
  return description.replace(/\s*\[[^\]]*\]\s*$/, '');
}

/** Collapse per-variable docs into one description per indicator. */
export function indicatorDescriptions(
  rows: Array<{ variable: string; description: string }>,
): Map<string, string> {
  const byIndicator = new Map<string, string>();
  for (const { variable, description } of rows) {
    const prose = stripUnitSuffix(description ?? '').trim();
    if (!prose) continue;
    const { indicator } = parseVariable(variable);
    if (!byIndicator.has(indicator)) byIndicator.set(indicator, prose);
  }
  return byIndicator;
}
