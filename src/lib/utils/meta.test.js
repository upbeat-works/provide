import { describe, test, expect } from 'bun:test';
import { extractEndYear } from './meta.js';

describe('extractEndYear', () => {
  test('returns the top-level endYear when present', () => {
    expect(extractEndYear({ endYear: 2100 })).toBe(2100);
  });

  test('tolerates undefined / bare scenarios without throwing', () => {
    expect(() => extractEndYear(undefined)).not.toThrow();
    expect(extractEndYear(undefined)).toBe(0);
    // A bare convention scenario ({uid, label}) has no year metadata yet.
    expect(extractEndYear({ uid: 'curpol', label: 'curpol' })).toBe(0);
    // A scenario carrying an explicit `characteristics: undefined` must not throw.
    expect(() => extractEndYear({ uid: 'x', characteristics: undefined })).not.toThrow();
  });
});
