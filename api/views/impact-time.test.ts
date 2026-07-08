import { describe, test, expect } from 'bun:test';
import { assembleImpactTime, zipBands, alignBands } from './impact-time';

describe('alignBands', () => {
  test('aligns percentiles to a union year axis; a year a percentile lacks becomes NaN, not a left-shift', () => {
    const rowsByPct = {
      '5th Percentile': [{ scenario: 'A', '2020': 1, '2025': 2 }], // stops at 2025
      '50th Percentile': [{ scenario: 'A', '2020': 3, '2025': 4, '2030': 5 }], // has 2030
    };
    const { years, byPct } = alignBands(rowsByPct);
    expect(years).toEqual([2020, 2025, 2030]);
    expect(byPct['50th Percentile'].A).toEqual([3, 4, 5]);
    expect(byPct['5th Percentile'].A[0]).toBe(1);
    expect(byPct['5th Percentile'].A[1]).toBe(2);
    expect(byPct['5th Percentile'].A[2]).toBeNaN(); // 2030 absent in p5 → NaN at the right index
  });

  test('treats null cells as missing (NaN), not 0', () => {
    const { byPct } = alignBands({ '50th Percentile': [{ scenario: 'A', '2020': 1, '2025': null }] });
    expect(byPct['50th Percentile'].A[1]).toBeNaN();
  });
});

describe('zipBands', () => {
  test('zips per-scenario percentile series into [min, mid, max] per year', () => {
    expect(zipBands([2020, 2025], { A: [1, 2] }, { A: [2, 3] }, { A: [3, 4] }, ['A'])).toEqual({
      A: [
        [1, 2, 3],
        [2, 3, 4],
      ],
    });
  });

  test('drops scenarios missing any of the three bands', () => {
    expect(zipBands([2020], { A: [1] }, { A: [2] }, {}, ['A'])).toEqual({});
  });

  test('matches requested scenarios to data keys case-insensitively, keyed by the requested name', () => {
    // The overshoot percentile data lives under the lowercase `SSP5-3.4-Os` run,
    // but the selection sends the canonical `SSP5-3.4-OS`. It must still resolve,
    // and the output must key by the requested name so the frontend finds it.
    const series = { 'SSP5-3.4-Os': [0.1, 0.2] };
    const bands = zipBands([2020, 2050], series, series, series, ['SSP5-3.4-OS']);
    expect(Object.keys(bands)).toEqual(['SSP5-3.4-OS']);
    expect(bands['SSP5-3.4-OS']).toEqual([
      [0.1, 0.1, 0.1],
      [0.2, 0.2, 0.2],
    ]);
  });
});

describe('assembleImpactTime', () => {
  const base = {
    indicator: 'Mean Temperature',
    years: [2020, 2025, 2030],
    p5: { Today: [1, 2, 3] },
    p50: { Today: [2, 3, 4] },
    p95: { Today: [3, 4, 5] },
    scenarios: ['Today'],
    model: 'MESMER',
    source: 'provide-internal',
  };

  test('derives the year axis from the year list', () => {
    const out = assembleImpactTime(base);
    expect(out.yearStart).toBe(2020);
    expect(out.yearStep).toBe(5);
  });

  test('zips percentiles into a per-year [min, value, max] band per scenario', () => {
    const out = assembleImpactTime(base);
    expect(out.data.Today).toEqual([
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
    ]);
  });

  test('only includes requested scenarios that have data', () => {
    const out = assembleImpactTime({
      ...base,
      p5: { Today: [1], 'High Renewables': [9] },
      p50: { Today: [2], 'High Renewables': [9] },
      p95: { Today: [3], 'High Renewables': [9] },
      years: [2020],
      scenarios: ['Today', 'Missing Scenario'],
    });
    expect(Object.keys(out.data)).toEqual(['Today']);
  });

  test('carries the indicator as title and the run model/source through', () => {
    const out = assembleImpactTime(base);
    expect(out.title).toBe('Mean Temperature');
    expect(out.model).toBe('MESMER');
    expect(out.source).toBe('provide-internal');
  });
});
