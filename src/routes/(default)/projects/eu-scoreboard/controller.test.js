import { describe, expect, test } from 'vitest';
import { getScoreboard } from './controller.js';

describe('scoreboard sector selection', () => {
  test.each([undefined, 'unknown', 'heat-stress'])('opens empty Heat stress for %s', (sector) => {
    const scoreboard = getScoreboard(sector);
    expect(scoreboard.sector.uid).toBe('heat-stress');
    expect(scoreboard.definitions).toEqual([]);
  });

  test('selects chart definitions for Testing', () => {
    const scoreboard = getScoreboard('testing');
    expect(scoreboard.sector.uid).toBe('testing');
    expect(scoreboard.definitions.length).toBeGreaterThan(0);
  });

  test('Testing exercises each supported chart type through real definitions', () => {
    const types = getScoreboard('testing').definitions.map(({ chartType }) => chartType);
    expect(types).toEqual(expect.arrayContaining(['line', 'line_with_range', 'stacked_bar', 'bubble']));
  });
});
