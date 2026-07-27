import { describe, test, expect } from 'bun:test';
import { resolveFacetSelection, type RunTags, type RunIndicators } from './facets';

// Three runs: two annual (one global, one national), one 5-yearly.
const runTags: RunTags = new Map([
  ['1', { 'Temporal Resolution': 'Annual', 'Spatial Resolution': 'Global' }],
  ['2', { 'Temporal Resolution': 'Annual', 'Spatial Resolution': 'National' }],
  ['3', { 'Temporal Resolution': '5 years', 'Spatial Resolution': 'Global' }],
]);

const runIndicators: RunIndicators = new Map([
  ['1', ['Mean Temperature', 'Hot Extreme']],
  ['2', ['Mean Temperature']],
  ['3', ['Sea Level Rise']],
]);

describe('resolveFacetSelection', () => {
  test('no filters: every run, every indicator, all discovered values', () => {
    const { runIds, indicators, facets } = resolveFacetSelection(runTags, runIndicators, {});
    expect(runIds).toEqual(['1', '2', '3']);
    expect([...indicators].sort()).toEqual(['Hot Extreme', 'Mean Temperature', 'Sea Level Rise']);
    expect(facets['Temporal Resolution']).toEqual([
      { value: '5 years', count: 1 },
      { value: 'Annual', count: 2 },
    ]);
  });

  test('counts distinct indicators, not runs or variables', () => {
    const { facets } = resolveFacetSelection(runTags, runIndicators, {});
    // Runs 1 and 2 both carry Mean Temperature; Annual must count it once.
    expect(facets['Temporal Resolution']).toContainEqual({ value: 'Annual', count: 2 });
  });

  test('a filter narrows the indicator set', () => {
    const { indicators } = resolveFacetSelection(runTags, runIndicators, {
      'Temporal Resolution': ['5 years'],
    });
    expect([...indicators]).toEqual(['Sea Level Rise']);
  });

  test('AND across keys', () => {
    const { runIds } = resolveFacetSelection(runTags, runIndicators, {
      'Temporal Resolution': ['Annual'],
      'Spatial Resolution': ['National'],
    });
    expect(runIds).toEqual(['2']);
  });

  test('OR within a key', () => {
    const { runIds } = resolveFacetSelection(runTags, runIndicators, {
      'Temporal Resolution': ['Annual', '5 years'],
    });
    expect(runIds).toEqual(['1', '2', '3']);
  });

  test('a group is not scoped by its own selection', () => {
    const { facets } = resolveFacetSelection(runTags, runIndicators, {
      'Temporal Resolution': ['Annual'],
    });
    // Both values stay selectable, so the user can switch without clearing.
    expect(facets['Temporal Resolution'].map((o) => o.value)).toEqual(['5 years', 'Annual']);
    // Spatial IS scoped: only the Annual runs' values, with their counts.
    expect(facets['Spatial Resolution']).toEqual([
      { value: 'Global', count: 2 },
      { value: 'National', count: 1 },
    ]);
  });

  test('a key with no data yields an empty group, not a missing one', () => {
    const { facets } = resolveFacetSelection(runTags, runIndicators, {});
    expect(facets['Data Source']).toEqual([]);
  });

  test('runs without the tag are excluded from that facet', () => {
    const partial: RunTags = new Map([['1', { 'Temporal Resolution': 'Annual' }], ['2', {}]]);
    const { facets } = resolveFacetSelection(partial, runIndicators, {});
    expect(facets['Temporal Resolution']).toEqual([{ value: 'Annual', count: 2 }]);
  });
});

describe('resolveFacetSelection — zero-count options', () => {
  test('keeps a value that has no results under the other filters, at count 0', () => {
    // Filtering to '5 years' leaves only run 3, which is Global. 'National'
    // must stay listed (muted, count 0) rather than vanishing.
    const { facets } = resolveFacetSelection(runTags, runIndicators, {
      'Temporal Resolution': ['5 years'],
    });
    expect(facets['Spatial Resolution']).toEqual([
      { value: 'Global', count: 1 },
      { value: 'National', count: 0 },
    ]);
  });

  test('still lists every discovered value when nothing is filtered', () => {
    const { facets } = resolveFacetSelection(runTags, runIndicators, {});
    expect(facets['Spatial Resolution'].map((o) => o.value)).toEqual(['Global', 'National']);
  });
});
