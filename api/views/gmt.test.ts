import { describe, test, expect } from 'bun:test';
import { assembleGmt, gmtCharacteristics, gmtBandsForYears } from './gmt';
import type { PercentileSeries } from './impact-time';

// The three GMT percentile series as alignBands hands them over.
const bands = (
  entries: Record<string, Record<string, number[]>>,
): Record<string, PercentileSeries> => entries;

describe('assembleGmt', () => {
  // Real numbers off provide-internal: the "10th Percentile" series carries the
  // HIGHEST values and "90th" the lowest, so the band edges cannot be read off
  // the label order.
  test('takes band edges numerically, not from the percentile labels', () => {
    const out = assembleGmt(
      [2100],
      bands({
        '10th Percentile': { A: [3.64056] },
        '50th Percentile': { A: [2.9277] },
        '90th Percentile': { A: [2.38706] },
      }),
    );
    expect(out.get('a')!.data).toEqual([[2.38706, 2.9277, 3.64056]]);
  });

  test('trims a scenario to the years it actually has, without shifting', () => {
    const years = [2020, 2025, 2030, 2035];
    const out = assembleGmt(
      years,
      bands({
        '10th Percentile': { A: [1.5, 1.6, NaN, NaN] },
        '50th Percentile': { A: [1.3, 1.4, NaN, NaN] },
        '90th Percentile': { A: [1.1, 1.2, NaN, NaN] },
      }),
    );
    const a = out.get('a')!;
    expect(a.data).toEqual([
      [1.1, 1.3, 1.5],
      [1.2, 1.4, 1.6],
    ]);
    expect(a.yearStart).toBe(2020);
    expect(a.yearEnd).toBe(2025);
    expect(a.yearStep).toBe(5);
  });

  test('falls back to the median alone when the band edges are missing', () => {
    const out = assembleGmt(
      [2100],
      bands({ '10th Percentile': { A: [NaN] }, '50th Percentile': { A: [2.5] }, '90th Percentile': { A: [NaN] } }),
    );
    expect(out.get('a')!.data).toEqual([[2.5, 2.5, 2.5]]);
  });

  test('drops a scenario with no median', () => {
    const out = assembleGmt(
      [2100],
      bands({ '10th Percentile': { A: [3.1] }, '50th Percentile': {}, '90th Percentile': { A: [2.1] } }),
    );
    expect(out.size).toBe(0);
  });

  test('keeps the raw ixmp4 scenario name for display', () => {
    const out = assembleGmt(
      [2100],
      bands({
        '10th Percentile': { 'SSP1-1.9': [1.7] },
        '50th Percentile': { 'SSP1-1.9': [1.3] },
        '90th Percentile': { 'SSP1-1.9': [1.0] },
      }),
    );
    expect(out.get('ssp1-1.9')!.scenario).toBe('SSP1-1.9');
  });
});

describe('gmtCharacteristics', () => {
  const pts = (o: Record<number, number>) =>
    Object.entries(o).map(([year, value]) => ({ year: Number(year), value }));

  test('derives peak, 2100 warming and the post-peak cooling rate', () => {
    const c = gmtCharacteristics(pts({ 2020: 1.3, 2060: 2.0, 2100: 1.6 }));
    expect(c.gmtPeak).toEqual([2, 2060]);
    expect(c.gmt2100).toBe(1.6);
    expect(c.coolingRateAfterPeak).toBe(0.1); // 0.4 °C over 4 decades
  });

  test('omits the cooling rate when warming peaks at 2100 (no post-peak window)', () => {
    const c = gmtCharacteristics(pts({ 2020: 1.3, 2060: 2.2, 2100: 3.6 }));
    expect(c.gmtPeak).toEqual([3.6, 2100]);
    expect('coolingRateAfterPeak' in c).toBe(false);
  });

  test('omits the 2300 keys for a scenario that stops at 2100', () => {
    const c = gmtCharacteristics(pts({ 2020: 1.3, 2060: 2.0, 2100: 1.6 }));
    expect('gmt2300' in c).toBe(false);
    expect('coolingAfterPeak' in c).toBe(false);
  });

  test('derives the 2300 keys when the series reaches it', () => {
    const c = gmtCharacteristics(pts({ 2020: 1.3, 2060: 2.0, 2100: 1.6, 2300: 1.2 }));
    expect(c.gmt2300).toBe(1.2);
    expect(c.coolingAfterPeak).toBe(0.8); // peak 2.0 -> 1.2
  });

  // Both the 2100 and the 2300 table columns describe the peak as "before 2100".
  test('measures the peak within the <= 2100 window even on a 2300 series', () => {
    const c = gmtCharacteristics(pts({ 2020: 1.3, 2100: 1.6, 2200: 3.0, 2300: 2.8 }));
    expect(c.gmtPeak).toEqual([1.6, 2100]);
  });

  test('reports the earliest year on a tie', () => {
    expect(gmtCharacteristics(pts({ 2050: 2.0, 2060: 2.0, 2100: 1.5 })).gmtPeak).toEqual([2, 2050]);
  });
});

describe('gmtBandsForYears', () => {
  const gmt = assembleGmt(
    [2020, 2025, 2030],
    bands({
      '10th Percentile': { 'SSP1-1.9': [1.5, 1.6, 1.7] },
      '50th Percentile': { 'SSP1-1.9': [1.3, 1.4, 1.5] },
      '90th Percentile': { 'SSP1-1.9': [1.1, 1.2, 1.3] },
    }),
  );

  test('projects onto a foreign year axis, NaN-filling the years GMT lacks', () => {
    const out = gmtBandsForYears(gmt, [2020, 2030, 2040], ['SSP1-1.9']);
    expect(out['SSP1-1.9'][0]).toEqual([1.1, 1.3, 1.5]);
    expect(out['SSP1-1.9'][1]).toEqual([1.3, 1.5, 1.7]);
    expect(out['SSP1-1.9'][2].every(Number.isNaN)).toBe(true);
  });

  test('matches case-insensitively and keys by the requested name', () => {
    const out = gmtBandsForYears(gmt, [2020], ['ssp1-1.9']);
    expect(Object.keys(out)).toEqual(['ssp1-1.9']);
  });

  test('omits scenarios GMT has no series for', () => {
    expect(gmtBandsForYears(gmt, [2020], ['Low Demand'])).toEqual({});
  });
});
