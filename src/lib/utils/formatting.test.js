import { describe, test, expect } from 'vitest';
import { formatCompact, formatRange, formatPercentPoints, formatValue, rescaleToBaseUnit } from './formatting.js';

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
    expect(formatValue(0.00326, 'people', { addSuffix: false })).toBe('3.26×10⁻³');
    expect(formatValue(0.0418, 'people', { addSuffix: false })).toBe('0.0418');
    expect(formatValue(0.000071, 'people', { addSuffix: false })).toBe('7.1×10⁻⁵');
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

test.each([
  [0.0000296, '2.96×10⁻⁵'], [0.000427, '4.27×10⁻⁴'], [0.000824, '8.24×10⁻⁴'],
  [0.000000000122, '1.22×10⁻¹⁰'], [0.00122, '1.22×10⁻³'], [0.00162, '1.62×10⁻³'], [-0.00162, '-1.62×10⁻³'],
])('formats small chart value %s consistently in ticks and tooltips', (value, expected) => {
  expect(formatCompact(value)).toBe(expected);
  expect(formatValue(value, 'days/yr', { decimals: 2 })).toBe(`${expected} days/yr`);
});

test('uses the displayed magnitude for percent notation and keeps the threshold decimal', () => {
  expect(formatCompact(0.01)).toBe('0.01');
  expect(formatCompact(-0.01)).toBe('−0.01');
  expect(formatValue(0.01, 'days/yr', { decimals: 2 })).toBe('0.01 days/yr');
  expect(formatValue(0.0000296, 'percent')).toBe('2.96×10⁻³ %');
  expect(formatCompact(0.0000296, 'percent')).toBe('2.96×10⁻³');
  expect(formatValue(0.001, 'percent', { decimals: 1 })).toBe('0.1 %');
});

test('uses scientific notation in line chart axis ranges without losing small ticks', () => {
  expect(formatRange([0, 0.0002, 0.0004, 0.0006], '1/return period').values).toEqual([
    '0 1/return period', '2×10⁻⁴ 1/return period', '4×10⁻⁴ 1/return period', '6×10⁻⁴ 1/return period',
  ]);
});

test('shows exact zero without decimal padding alongside small nonzero values', () => {
  expect(formatValue(0, '1/return period', { decimals: 3 })).toBe('0 1/return period');
  expect(formatValue(-0, '1/return period', { decimals: 3 })).toBe('0 1/return period');
  expect(formatValue(0.0000296, '1/return period', { decimals: 3 })).toBe('2.96×10⁻⁵ 1/return period');
  expect(formatRange([0, 0.125, 0.126], '1/return period').values).toEqual(['0 1/return period', '0.125 1/return period', '0.126 1/return period']);
});
