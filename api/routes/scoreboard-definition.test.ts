import { describe, expect, test } from 'vitest';
import { definitionGroupingError } from './scoreboard';

const reference = { variable: 'Value', model: 'Model', unit: 'unit' };

describe('scoreboard grouping validation', () => {
  test.each([
    ['model', 'stacked_bar'],
    ['region', 'line'],
  ])('rejects %s grouping for %s before data resolution', (groupBy, chartType) => {
    expect(definitionGroupingError({ chartId: 'chart', chartType, data: { groupBy, series: [{ segment: reference }] } })).toBe('Unsupported chart grouping');
  });
});
