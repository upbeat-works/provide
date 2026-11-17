import { describe, expect, test } from 'vitest';
import { getTestScoreboard as getScoreboard } from '../../../../../test/fixtures/scoreboard.js';

describe('scoreboard sector selection', () => {
  test.each([undefined, 'unknown', 'heat-stress'])('opens Heat stress for %s', (sector) => {
    const scoreboard = getScoreboard(sector);
    expect(scoreboard.sector.uid).toBe('heat-stress');
  });

  test('selects chart definitions for Testing', () => {
    const scoreboard = getScoreboard('testing');
    expect(scoreboard.sector.uid).toBe('testing');
    expect(scoreboard.charts.length).toBeGreaterThan(0);
  });
});
