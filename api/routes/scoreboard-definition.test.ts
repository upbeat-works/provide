import { describe, expect, test } from 'vitest';
import { definitionGroupingError } from '../scoreboard/charts';

describe('scoreboard grouping validation', () => {
  test.each([
    ['model', 'stacked_bar'],
    ['region', 'line_with_range'],
  ])('rejects %s grouping for %s before data resolution', (groupBy, chartType) => {
    expect(definitionGroupingError({ chartId: 'chart', chartType, data: { groupBy, variables: ['Value'] } })).toBe('Unsupported chart grouping');
  });
});
