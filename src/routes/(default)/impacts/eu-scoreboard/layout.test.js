import { expect, test } from 'vitest';
import { getTestScoreboard as getScoreboard } from '../../../../../test/fixtures/scoreboard.js';
import { load } from './+layout.js';
import { SCOREBOARD_COUNTRIES } from './controller.js';

test('turns local config into labelled choices and retains valid URL values', () => {
  const scoreboard = getScoreboard('testing', 'Mean Air Temperature');
  const country = SCOREBOARD_COUNTRIES[0].name;
  const result = load({
    data: { scoreboard, scenarioLabels: { CurrentPolicies: 'Current policies' } },
    url: new URL(
      `https://example.test/impacts/eu-scoreboard/indicators?sector=testing&indicator=Mean%20Air%20Temperature&scenario=1.5C&region=${encodeURIComponent(country)}&year=2100`
    ),
  });

  expect(result.selection).toEqual({
    indicator: { uid: 'Mean Air Temperature', label: 'Mean Air Temperature' },
    scenario: { uid: '1.5C', label: '1.5C' },
    region: { uid: country, label: country },
    year: { uid: '2100', label: '2100' },
  });
  expect(result.scenarios[0]).toEqual({ uid: 'CurrentPolicies', label: 'Current policies' });
  expect(result.regions.map(({ uid }) => uid).sort()).toEqual(SCOREBOARD_COUNTRIES.map(({ name }) => name).sort());
});

test('defaults to Europe and the configured year without a discovery request', () => {
  const scoreboard = getScoreboard('testing');
  const result = load({ data: { scoreboard, scenarioLabels: {} }, url: new URL('https://example.test/impacts/eu-scoreboard/indicators') });

  expect(result.selection.region.uid).toBe('all');
  expect(result.selection.year.uid).toBe('2050');
});
