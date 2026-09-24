import { describe, expect, test } from 'vitest';
import { createScoreboardOptions, resolveSelection } from './selection.js';
import { getScoreboard } from './controller.js';

describe('scoreboard choices', () => {
  const scoreboard = {
    map: {
      defaultIndicator: 'Maximum Air Temperature',
      indicators: [{ name: 'Maximum Air Temperature' }, { name: 'Mean Air Temperature' }],
      scenarios: [{ id: 'CurrentPolicies' }, { id: '1.5C' }],
      years: [2020, 2030, 2050, 2100],
    },
  };

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
    expect(options.regions.map(({ label }) => label)).toEqual(
      options.regions.map(({ label }) => label).sort((a, b) => a.localeCompare(b))
    );
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

  test('keeps chart choices when a sector has no regional map indicator', () => {
    const chartsOnly = { ...scoreboard, map: { ...scoreboard.map, indicators: [] }, indicator: undefined };
    const options = createScoreboardOptions(chartsOnly);

    expect(options.indicators).toEqual([]);
    expect(resolveSelection(chartsOnly, options, { scenario: '1.5C', region: 'Ukraine', year: '2100' })).toEqual({
      indicator: undefined,
      scenario: { uid: '1.5C', label: '1.5C' },
      region: { uid: 'Ukraine', label: 'Ukraine' },
      year: { uid: '2100', label: '2100' },
    });
  });

  test.each(['heat-stress', 'socioeconomic', 'testing'])('offers 2040 and 2075 for %s', (sector) => {
    const scoreboard = getScoreboard(sector);
    const options = createScoreboardOptions(scoreboard);
    expect(options.years.map(({ uid }) => uid)).toEqual(['2020', '2030', '2040', '2050', '2075', '2100']);
    expect(resolveSelection(scoreboard, options, { year: '2075' }).year).toEqual({ uid: '2075', label: '2075' });
  });

  test('shows a clear map indicator name while keeping its data variable', () => {
    const socioeconomic = getScoreboard('socioeconomic');
    const options = createScoreboardOptions(socioeconomic);

    expect(options.indicators).toContainEqual({ uid: 'Population aged 65 and over', label: 'Population aged 65 and over' });
    expect(socioeconomic.indicator.variable).toBe('Population|Age 65+');
  });
});
