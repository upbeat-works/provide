import { describe, expect, test } from 'vitest';
import { getScoreboard, resolveScoreboardChoices, SCOREBOARD_COUNTRIES } from './controller.js';

describe('scoreboard config', () => {
  test('uses the configured default indicator unless a valid indicator is requested', () => {
    const scoreboard = {
      map: {
        defaultIndicator: 'Heat risk',
        indicators: [{ name: 'Temperature' }, { name: 'Heat risk' }],
        scenarios: [{ id: 'Scenario' }],
        years: [2050],
      },
    };

    expect(resolveScoreboardChoices(scoreboard).indicator).toBe('Heat risk');
    expect(resolveScoreboardChoices(scoreboard, { indicator: 'Missing' }).indicator).toBe('Heat risk');
    expect(resolveScoreboardChoices(scoreboard, { indicator: 'Temperature' }).indicator).toBe('Temperature');
  });

  test('selects a named map indicator and returns the sector charts', () => {
    const scoreboard = getScoreboard('testing', 'Mean Air Temperature');

    expect(scoreboard.indicator).toEqual({
      name: 'Mean Air Temperature',
      variable: 'Mean Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile',
      type: 'choropleth',
      level: 'NUTS2',
    });
    expect(scoreboard.charts.map(({ chartId }) => chartId)).toContain('maximum-air-temperature-range');
  });

  test('keeps valid URL choices and defaults invalid choices locally', () => {
    const scoreboard = getScoreboard('testing');

    expect(
      resolveScoreboardChoices(scoreboard, {
        indicator: 'Mean Air Temperature',
        scenario: '1.5C',
        region: 'Ukraine',
        year: '2100',
      })
    ).toEqual({ indicator: 'Mean Air Temperature', scenario: '1.5C', region: 'Ukraine', year: 2100 });
    expect(resolveScoreboardChoices(scoreboard, { indicator: 'Missing', scenario: 'Missing', region: 'Missing', year: '2040' })).toEqual({
      indicator: 'Maximum Air Temperature',
      scenario: 'CurrentPolicies',
      region: 'Austria',
      year: 2050,
    });
    expect(resolveScoreboardChoices({ ...scoreboard, map: { ...scoreboard.map, years: [2030, 2100] } }, {})).toMatchObject({ year: 2030 });
  });

  test('offers all 40 NUTS countries with source codes', () => {
    expect(SCOREBOARD_COUNTRIES).toHaveLength(40);
    expect(SCOREBOARD_COUNTRIES).toContainEqual({ name: 'Ukraine', iso3: 'UKR', code: 'UA' });
    expect(SCOREBOARD_COUNTRIES).toContainEqual({ name: 'Greece', iso3: 'GRC', code: 'EL' });
    expect(SCOREBOARD_COUNTRIES).toContainEqual({ name: 'United Kingdom', iso3: 'GBR', code: 'UK' });
  });

  test('keeps chart choices usable when a sector has no map indicators', () => {
    const scoreboard = getScoreboard('testing');
    const chartsOnly = { ...scoreboard, map: { ...scoreboard.map, indicators: [] } };

    expect(resolveScoreboardChoices(chartsOnly, { indicator: 'Mean Air Temperature', scenario: '1.5C', region: 'Germany', year: '2100' })).toEqual({
      indicator: undefined,
      scenario: '1.5C',
      region: 'Germany',
      year: 2100,
    });
  });

  test('switches from climate filters to the socioeconomic scenario choices', () => {
    const scoreboard = getScoreboard('socioeconomic', 'Mean Air Temperature');

    expect(scoreboard.sector.uid).toBe('socioeconomic');
    expect(resolveScoreboardChoices(scoreboard, { indicator: 'Mean Air Temperature', scenario: 'CurrentPolicies', region: 'Germany', year: '2050' })).toEqual({
      indicator: undefined,
      scenario: 'CurrentPolicies_SSP1',
      region: 'Germany',
      year: 2050,
    });
    expect(resolveScoreboardChoices(scoreboard, { scenario: '1.5C_SSP2', region: 'France', year: '2100' })).toMatchObject({
      scenario: '1.5C_SSP2',
      region: 'France',
      year: 2100,
    });
  });
});
