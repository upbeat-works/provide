import { describe, expect, test } from 'vitest';
import { definitionGroupingError } from '../scoreboard/charts';

describe('scoreboard grouping validation', () => {
  test.each([
    // A groupBy the resolver has no concept of at all.
    ['model', 'stacked_bar'],
    // Time series may only be grouped by region: a scenario per line would
    // collide with the scenario the selection already fixes.
    ['scenario', 'line'],
    ['scenario', 'line_with_range'],
  ])('rejects %s grouping for %s before data resolution', (groupBy, chartType) => {
    expect(definitionGroupingError({ chartId: 'chart', chartType, data: { groupBy, variables: ['Value'] } })).toBe('Unsupported chart grouping');
  });

  // The socioeconomic sector ships region-grouped line charts (one line per
  // NUTS2 region), so this pairing has to stay allowed.
  test.each([
    ['region', 'line'],
    ['region', 'stacked_bar'],
    ['scenario', 'stacked_bar'],
  ])('accepts %s grouping for %s', (groupBy, chartType) => {
    expect(definitionGroupingError({ chartId: 'chart', chartType, data: { groupBy, variables: ['Value'] } })).toBeNull();
  });
});
