import { describe, test, expect } from 'bun:test';
import { formatValue } from './formatting.js';

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
