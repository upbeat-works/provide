import { describe, test, expect } from 'bun:test';
import { avoidAvailableIndicators, avoidIndicatorParameters, reconcileAvoidParams, avoidSectors, reconcileSector } from './avoid-selection.js';

const INDS = [
  { uid: 'a', availableGeographies: ['accra', 'amman'] },
  { uid: 'b', availableGeographies: ['amman'] },
];

describe('avoid-selection helpers', () => {
  test('avoidAvailableIndicators filters by city membership', () => {
    expect(avoidAvailableIndicators(INDS, 'accra').map((i) => i.uid)).toEqual(['a']);
    expect(avoidAvailableIndicators(INDS, undefined).map((i) => i.uid)).toEqual(['a', 'b']);
  });

  test('avoidIndicatorParameters keeps allowed options and drops single-option params', () => {
    const indicator = { parameters: { time: ['2050', '2100'], reference: ['absolute'] } };
    const params = [
      { uid: 'time', label: 'Time', options: [{ uid: '2050' }, { uid: '2100' }, { uid: '2030' }] },
      { uid: 'reference', label: 'Reference', options: [{ uid: 'absolute' }, { uid: 'relative' }] },
    ];
    const out = avoidIndicatorParameters(indicator, params);
    expect(out.map((p) => p.uid)).toEqual(['time']); // reference collapses to 1 → hidden
    expect(out[0].options.map((o) => o.uid)).toEqual(['2050', '2100']);
  });

  test('avoidSectors counts indicators per sector, labelled from meta with uid + other fallback', () => {
    const inds = [{ sector: 'urban-climate' }, { sector: 'urban-climate' }, { sector: 'glacier' }, {}];
    const meta = [{ uid: 'urban-climate', label: 'Urban heat stress' }];
    expect(avoidSectors(inds, meta)).toEqual([
      { uid: 'urban-climate', label: 'Urban heat stress', count: 2 },
      { uid: 'glacier', label: 'glacier', count: 1 }, // no meta label → uid
      { uid: 'other', label: 'other', count: 1 }, // no sector field → 'other'
    ]);
  });

  test('reconcileSector keeps valid, resets stale/undefined, no-ops when empty', () => {
    const sectors = [{ uid: 'a' }, { uid: 'b' }];
    expect(reconcileSector('b', sectors)).toBe('b');
    expect(reconcileSector('stale', sectors)).toBe('a');
    expect(reconcileSector(undefined, sectors)).toBe('a');
    expect(reconcileSector('x', [])).toBe('x'); // nothing to reconcile against yet
  });

  test('reconcileAvoidParams keeps valid previous values, defaults the rest', () => {
    const params = [
      { uid: 'time', options: [{ uid: '2050' }, { uid: '2100' }] },
      { uid: 'reference', options: [{ uid: 'absolute' }, { uid: 'relative' }] },
    ];
    expect(reconcileAvoidParams(params, { time: '2100', reference: 'stale' })).toEqual({
      time: '2100', // kept (still valid)
      reference: 'absolute', // reset (invalid) → first option
    });
  });
});
