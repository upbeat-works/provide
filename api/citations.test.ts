import { describe, test, expect } from 'bun:test';
import { citationsByIndicator, type RunIndicators } from './facets';

describe('citationsByIndicator', () => {
  test('attributes a run\'s citations to every indicator it carries', () => {
    const runIndicators: RunIndicators = new Map([['i#1', ['Mean Temperature', 'Hot Extreme']]]);
    const citations = new Map([['i#1', { model: 'MESMER (Beusch et al., 2020)', source: 'Schwaab et al.' }]]);
    const result = citationsByIndicator(runIndicators, citations);
    expect(result.get('Mean Temperature')).toEqual({
      models: ['MESMER (Beusch et al., 2020)'],
      sources: ['Schwaab et al.'],
    });
    expect(result.get('Hot Extreme')?.models).toEqual(['MESMER (Beusch et al., 2020)']);
  });

  test('collects distinct values when an indicator spans several runs', () => {
    const runIndicators: RunIndicators = new Map([
      ['i#1', ['Mean Temperature']],
      ['i#2', ['Mean Temperature']],
      ['i#3', ['Mean Temperature']],
    ]);
    const citations = new Map([
      ['i#1', { model: 'MESMER' }],
      ['i#2', { model: 'MESMER-M' }],
      ['i#3', { model: 'MESMER' }],
    ]);
    expect(citationsByIndicator(runIndicators, citations).get('Mean Temperature')?.models).toEqual([
      'MESMER',
      'MESMER-M',
    ]);
  });

  test('drops the "-" placeholder', () => {
    const runIndicators: RunIndicators = new Map([['i#1', ['Mean Temperature']]]);
    const citations = new Map([['i#1', { model: 'MESMER-M', source: '-' }]]);
    expect(citationsByIndicator(runIndicators, citations).get('Mean Temperature')).toEqual({
      models: ['MESMER-M'],
      sources: [],
    });
  });

  test('an indicator whose runs carry no meta is absent', () => {
    const runIndicators: RunIndicators = new Map([['i#1', ['Glacier area']]]);
    expect(citationsByIndicator(runIndicators, new Map()).has('Glacier area')).toBe(false);
  });
});
