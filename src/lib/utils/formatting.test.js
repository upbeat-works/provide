import { describe, test, expect } from 'vitest';
import { formatCompact, formatPercentPoints, formatValue, rescaleToBaseUnit } from './formatting.js';

describe('formatValue with natural-language units', () => {
  test('appends a natural-language unit (not in the registry) as a suffix', () => {
    expect(formatValue(1.53, '°C', { decimals: 1 })).toBe('1.5 °C');
    expect(formatValue(42, 'days/year', { decimals: 0 })).toBe('42 days/year');
  });

  test('does not append registry ids or sentinels', () => {
    expect(formatValue(1.53, 'float', { decimals: 1 })).toBe('1.5'); // registry id
    expect(formatValue(1.53, 'no unit', { decimals: 1 })).toBe('1.5'); // UID_NO_UNIT
  });
});

describe('formatPercentPoints', () => {
  test('formats percentage-point values without scaling them', () => {
    expect(formatPercentPoints(25)).toBe('25 %');
  });
});

describe('sub-unit values on an unregistered unit', () => {
  test('keeps significant digits instead of collapsing to zero', () => {
    expect(formatValue(0.00326, 'people', { addSuffix: false })).toBe('0.00326');
    expect(formatValue(0.0418, 'people', { addSuffix: false })).toBe('0.0418');
    expect(formatValue(0.000071, 'people', { addSuffix: false })).toBe('0.000071');
  });

  test('leaves values of one and above on the previous integer rendering', () => {
    expect(formatValue(42, 'people', { addSuffix: false })).toBe('42');
    expect(formatValue(3262, 'people', { addSuffix: false })).toBe('3,262');
    expect(formatValue(0, 'people', { addSuffix: false })).toBe('0');
  });
});

describe('rescaleToBaseUnit', () => {
  test('converts a scale word into the declared base unit', () => {
    expect(rescaleToBaseUnit(0.00326238040812039, 'million', 'people')).toEqual({ value: 3262.38040812039, unit: 'people' });
    expect(rescaleToBaseUnit(2, 'thousand', 'people')).toEqual({ value: 2000, unit: 'people' });
  });

  test('leaves a real unit, or a scale word with no base to convert into, untouched', () => {
    expect(rescaleToBaseUnit(1.5, '°C', 'people')).toEqual({ value: 1.5, unit: '°C' });
    expect(rescaleToBaseUnit(0.003, 'million', undefined)).toEqual({ value: 0.003, unit: 'million' });
  });
});

describe('formatCompact for axis ticks', () => {
  test('takes an SI prefix once the number is wide enough to crowd its neighbours', () => {
    expect(formatCompact(41844)).toBe('41.8k');
    expect(formatCompact(1234567)).toBe('1.23M');
  });

  test('spells out smaller numbers rather than prefixing them', () => {
    expect(formatCompact(3262)).toBe('3,262');
    expect(formatCompact(0.0418)).toBe('0.0418');
    expect(formatCompact(0)).toBe('0');
  });
});

test('keeps fractional axis ticks distinct and preserves percent scaling', () => {
  expect([1.1, 1.2, 1.3, 1.4].map((value) => formatCompact(value))).toEqual(['1.1', '1.2', '1.3', '1.4']);
  expect(formatCompact(0.25, 'percent')).toBe('25');
});
