import { expect, test } from 'vitest';
import { getScoreboard } from './controller.js';
import { load } from './+layout.js';

test('turns local config into labelled choices and retains valid URL values', () => {
  const scoreboard = getScoreboard('testing', 'Mean Air Temperature');
  const result = load({
    data: { scoreboard, scenarioLabels: { CurrentPolicies: 'Current policies' } },
    url: new URL(
      'https://example.test/projects/eu-scoreboard/indicators?sector=testing&indicator=Mean%20Air%20Temperature&scenario=1.5C&region=Ukraine&year=2100'
    ),
  });

  expect(result.selection).toEqual({
    indicator: { uid: 'Mean Air Temperature', label: 'Mean Air Temperature' },
    scenario: { uid: '1.5C', label: '1.5C' },
    region: { uid: 'Ukraine', label: 'Ukraine' },
    year: { uid: '2100', label: '2100' },
  });
  expect(result.scenarios[0]).toEqual({ uid: 'CurrentPolicies', label: 'Current policies' });
  expect(result.regions).toHaveLength(40);
});

test('defaults the country and year without a discovery request', () => {
  const scoreboard = getScoreboard('testing');
  const result = load({ data: { scoreboard, scenarioLabels: {} }, url: new URL('https://example.test/projects/eu-scoreboard/indicators') });

  expect(result.selection.region.uid).toBe('Austria');
  expect(result.selection.year.uid).toBe('2050');
});
