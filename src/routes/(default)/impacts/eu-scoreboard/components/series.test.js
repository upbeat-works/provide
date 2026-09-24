import { describe, test, expect } from 'bun:test';
import { stackCumulative } from './series.js';

const layers = [
  { uid: 'low', label: 'Base', color: '#eee' },
  { uid: 'mid', label: '+ mid', color: '#999' },
  { uid: 'high', label: '+ high', color: '#111' },
];

describe('stackCumulative', () => {
  test('turns cumulative totals into abutting segments', () => {
    const [row] = stackCumulative([{ uid: 'AT13', label: 'Vienna', totals: [1.4, 1.85, 3.6] }], layers);

    expect(row.values).toEqual([
      { uid: 'low', name: 'Base', color: '#eee', start: 0, end: 1.4 },
      { uid: 'mid', name: '+ mid', color: '#999', start: 1.4, end: 1.85 },
      { uid: 'high', name: '+ high', color: '#111', start: 1.85, end: 3.6 },
    ]);
    // The bar is as long as the highest pathway's total, not the sum of the three.
    expect(row.total).toBe(3.6);
  });

  test('keeps the row it was given', () => {
    const [row] = stackCumulative([{ uid: 'AT13', label: 'Vienna', totals: [1] }], layers);
    expect(row.uid).toBe('AT13');
    expect(row.label).toBe('Vienna');
    // The totals are consumed by the stacking; only the segments are drawn.
    expect(row.totals).toBeUndefined();
  });

  test('drops a layer that adds nothing rather than drawing a zero-width sliver', () => {
    const [row] = stackCumulative([{ label: 'Flat', totals: [2, 2, 3] }], layers);
    expect(row.values.map(({ uid }) => uid)).toEqual(['low', 'high']);
  });

  test('ignores missing and out-of-order totals instead of drawing backwards', () => {
    const [row] = stackCumulative([{ label: 'Partial', totals: [1, undefined, 0.5] }], layers);
    expect(row.values.map(({ uid }) => uid)).toEqual(['low']);
    expect(row.total).toBe(1);
  });

  test('survives a row with no totals at all', () => {
    expect(stackCumulative([{ label: 'Empty' }], layers)).toEqual([{ label: 'Empty', values: [], total: 0 }]);
  });
});
