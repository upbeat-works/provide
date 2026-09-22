import { describe, expect, test } from 'vitest';
import { getScoreboard } from './controller.js';
import { createScoreboardOptions, resolveSelection } from './selection.js';

describe('scoreboard choices', () => {
  const scoreboard = getScoreboard('testing');

  test('builds choices from the selected sector and shared country list', () => {
    const options = createScoreboardOptions(scoreboard, { CurrentPolicies: 'Current policies' });

    expect(options.indicators).toEqual([
      { uid: 'Maximum Air Temperature', label: 'Maximum Air Temperature' },
      { uid: 'Mean Air Temperature', label: 'Mean Air Temperature' },
    ]);
    expect(options.scenarios).toEqual([
      { uid: 'CurrentPolicies', label: 'Current policies' },
      { uid: '1.5C', label: '1.5C' },
    ]);
    expect(options.regions).toHaveLength(40);
    expect(options.regions).toContainEqual({ uid: 'Ukraine', label: 'Ukraine' });
    expect(options.years).toEqual(['2020', '2030', '2050', '2100'].map((uid) => ({ uid, label: uid })));
  });

  test('defaults to the first configured indicator and scenario, Austria, and 2050', () => {
    const options = createScoreboardOptions(scoreboard);

    expect(resolveSelection(scoreboard, options, {})).toEqual({
      indicator: options.indicators[0],
      scenario: options.scenarios[0],
      region: { uid: 'Austria', label: 'Austria' },
      year: { uid: '2050', label: '2050' },
    });
  });

  test('keeps every valid URL choice', () => {
    const options = createScoreboardOptions(scoreboard);

    expect(
      resolveSelection(scoreboard, options, {
        indicator: 'Mean Air Temperature',
        scenario: '1.5C',
        region: 'Ukraine',
        year: '2100',
      })
    ).toEqual({
      indicator: { uid: 'Mean Air Temperature', label: 'Mean Air Temperature' },
      scenario: { uid: '1.5C', label: '1.5C' },
      region: { uid: 'Ukraine', label: 'Ukraine' },
      year: { uid: '2100', label: '2100' },
    });
  });
});
