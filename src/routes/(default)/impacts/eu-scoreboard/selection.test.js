import { describe, expect, test } from 'vitest';
import { createScoreboardOptions, resolveSelection } from './selection.js';

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

  test('defaults to the first configured indicator and scenario, Europe, and 2050', () => {
    const options = createScoreboardOptions(scoreboard);

    expect(resolveSelection(scoreboard, options, {})).toEqual({
      indicator: options.indicators[0],
      scenario: options.scenarios[0],
      region: { uid: 'all', label: 'Europe' },
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

  test('offers the configured years and accepts a year between decades', () => {
    const configured = { ...scoreboard, map: { ...scoreboard.map, years: [2040, 2075] } };
    const options = createScoreboardOptions(configured);
    expect(options.years).toEqual([{ uid: '2040', label: '2040' }, { uid: '2075', label: '2075' }]);
    expect(resolveSelection(configured, options, { year: '2075' }).year).toEqual({ uid: '2075', label: '2075' });
  });

  test('uses the display name for indicator choices and URL selection', () => {
    const configured = {
      ...scoreboard,
      map: {
        ...scoreboard.map,
        indicators: [{ name: 'People at risk', variable: 'Population|Exposure' }],
      },
    };
    const options = createScoreboardOptions(configured);

    expect(options.indicators).toEqual([{ uid: 'People at risk', label: 'People at risk' }]);
    expect(resolveSelection(configured, options, { indicator: 'People at risk' }).indicator).toEqual(options.indicators[0]);
  });

  test('keeps the Europe-wide selection when loading a shared URL', () => {
    const options = createScoreboardOptions(scoreboard);
    expect(resolveSelection(scoreboard, options, { region: 'all' }).region).toEqual({ uid: 'all', label: 'Europe' });
  });
});
