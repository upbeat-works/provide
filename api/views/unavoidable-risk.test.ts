import { describe, test, expect } from 'bun:test';
import { assembleEnsemble, pickDefaultThreshold, type ThresholdRows } from './unavoidable-risk';

// Two thresholds, given out of order so the test also proves ascending sorting.
// Each threshold's wide rows carry every scenario (projected + the Today
// baseline), the way one tabulate call returns them.
const thresholdRows: ThresholdRows[] = [
  {
    threshold: 2.0,
    rows: [
      { scenario: 'curpol', '2020': 0.1, '2030': 0.5 },
      { scenario: 'Today', '2020': 0.05 },
    ],
  },
  {
    threshold: 1.5,
    rows: [
      { scenario: 'curpol', '2020': 0.3, '2030': 0.7 },
      { scenario: 'Today', '2020': 0.2 },
    ],
  },
];

const base = {
  indicator: 'Mean Temperature',
  thresholdRows,
  scenarios: ['curpol'],
  todayScenario: 'Today',
  model: 'MESMER',
  source: 'provide-internal',
};

describe('pickDefaultThreshold', () => {
  test('returns the middle of the sorted set', () => {
    expect(pickDefaultThreshold([0, 0.5, 1, 1.5, 2])).toBe(1);
    expect(pickDefaultThreshold([1.5, 2.0])).toBe(1.5);
  });

  test('returns 0 for an empty set', () => {
    expect(pickDefaultThreshold([])).toBe(0);
  });
});

describe('assembleEnsemble', () => {
  test('emits thresholds ascending and years ascending', () => {
    const out = assembleEnsemble(base);
    expect(out.thresholds).toEqual([1.5, 2.0]);
    expect(out.years).toEqual([2020, 2030]);
  });

  test('shapes data[scenario] as [threshold][year] in ascending threshold order', () => {
    const out = assembleEnsemble(base);
    // Row 0 = threshold 1.5 over [2020, 2030]; row 1 = threshold 2.0.
    expect(out.data.curpol).toEqual([
      [0.3, 0.7],
      [0.1, 0.5],
    ]);
    expect(out.data.curpol).toHaveLength(out.thresholds.length);
    expect(out.data.curpol[0]).toHaveLength(out.years.length);
  });

  test('derives today (one value per threshold, ascending) from the Today scenario', () => {
    const out = assembleEnsemble(base);
    expect(out.today).toEqual([0.2, 0.05]);
    expect(out.today).toHaveLength(out.thresholds.length);
  });

  test('never emits the Today baseline as a projected line', () => {
    const out = assembleEnsemble(base);
    expect(Object.keys(out.data)).toEqual(['curpol']);
  });

  test('drops requested scenarios with no data and NaN-fills missing threshold/year cells', () => {
    const rows: ThresholdRows[] = [
      { threshold: 1.5, rows: [{ scenario: 'gs', '2020': 0.4, '2030': 0.8 }] },
      { threshold: 2.0, rows: [] }, // gs absent at 2.0
    ];
    const out = assembleEnsemble({ ...base, thresholdRows: rows, scenarios: ['gs', 'absent'] });
    expect(Object.keys(out.data)).toEqual(['gs']);
    expect(out.data.gs[0]).toEqual([0.4, 0.8]); // threshold 1.5
    expect(out.data.gs[1][0]).toBeNaN(); // threshold 2.0, 2020 missing
    expect(out.data.gs[1][1]).toBeNaN();
  });

  test('excludes years where no requested scenario has a finite value (e.g. a leading empty 2000)', () => {
    const rows: ThresholdRows[] = [
      {
        threshold: 1.5,
        rows: [{ scenario: 'curpol', '2000': null, '2030': 0.3, '2050': 0.7 }], // 2000 empty
      },
      {
        threshold: 2.0,
        rows: [{ scenario: 'curpol', '2000': null, '2030': 0.1, '2050': 0.5 }],
      },
    ];
    const out = assembleEnsemble({ ...base, thresholdRows: rows, scenarios: ['curpol'] });
    expect(out.years).toEqual([2030, 2050]); // 2000 dropped, not carried as a null column
    expect(out.data.curpol).toEqual([
      [0.3, 0.7],
      [0.1, 0.5],
    ]);
  });

  test('year axis ignores years that only the Today baseline has', () => {
    const rows: ThresholdRows[] = [
      {
        threshold: 1.5,
        rows: [
          { scenario: 'curpol', '2020': 0.3, '2030': 0.7 },
          { scenario: 'Today', '2010': 0.2 }, // 2010 must not enter the axis
        ],
      },
    ];
    const out = assembleEnsemble({ ...base, thresholdRows: rows });
    expect(out.years).toEqual([2020, 2030]);
  });

  test('defaultThreshold falls back to the middle, or passes an explicit value through', () => {
    expect(assembleEnsemble(base).defaultThreshold).toBe(1.5);
    expect(assembleEnsemble({ ...base, defaultThreshold: 2.0 }).defaultThreshold).toBe(2.0);
  });

  test('carries indicator as title and run model/source through', () => {
    const out = assembleEnsemble(base);
    expect(out.title).toBe('Mean Temperature');
    expect(out.model).toBe('MESMER');
    expect(out.source).toBe('provide-internal');
  });

  test('matches requested scenarios (and today) case-insensitively, keyed by the requested name', () => {
    // The exceedance data may sit under a differently-cased run than the
    // canonical name the selector sends (the SSP5-3.4-OS/Os source duplicate).
    // It must still resolve, with output keyed by the requested name.
    const rows: ThresholdRows[] = [
      {
        threshold: 1.5,
        rows: [
          { scenario: 'SSP5-3.4-Os', '2020': 0.3, '2030': 0.7 }, // data under lowercase
          { scenario: 'today', '2020': 0.2 }, // baseline lower-cased too
        ],
      },
    ];
    const out = assembleEnsemble({ ...base, thresholdRows: rows, scenarios: ['SSP5-3.4-OS'], todayScenario: 'Today' });
    expect(Object.keys(out.data)).toEqual(['SSP5-3.4-OS']);
    expect(out.years).toEqual([2020, 2030]);
    expect(out.data['SSP5-3.4-OS']).toEqual([[0.3, 0.7]]);
    expect(out.today).toEqual([0.2]);
  });
});
