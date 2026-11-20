import { expect, test } from 'vitest';
import { getTestScoreboard as getScoreboard } from '../../../../../../test/fixtures/scoreboard.js';
import { load } from './+page.js';

const option = (uid) => ({ uid, label: uid });
const scoreboard = getScoreboard('testing', 'Mean Air Temperature');
const selection = {
  indicator: option('Mean Air Temperature'),
  scenario: option('CurrentPolicies'),
  region: option('Austria'),
  year: option('2050'),
};

test('prepares independently loading panels with the definitions they need', async () => {
  const result = await load({ parent: async () => ({ scoreboard, selection }) });
  expect(result.map).toEqual({ definition: scoreboard.indicator, status: 'loading' });
  expect(result.charts[0]).toEqual({
    definition: scoreboard.charts[0],
    result: { definition: scoreboard.charts[0], status: 'loading' },
  });
});

test('prepares charts without a map for a charts-only sector', async () => {
  const chartsOnly = { ...scoreboard, map: { ...scoreboard.map, indicators: [] }, indicator: undefined };
  const result = await load({ parent: async () => ({ scoreboard: chartsOnly, selection: { ...selection, indicator: undefined } }) });
  expect(result.map).toBeUndefined();
  expect(result.charts).toHaveLength(chartsOnly.charts.length);
});

test.each(['all', 'Austria'])('loads charts allowed in the %s view', async (region) => {
  const charts = scoreboard.charts.slice(0, 3).map((chart, i) => ({ ...chart, hideInEuropeView: i === 0 }));
  const result = await load({ parent: async () => ({ scoreboard: { ...scoreboard, charts }, selection: { ...selection, region: option(region) } }) });
  const expected = region === 'all' ? charts.slice(1) : charts;
  expect(result.charts.map(({ definition }) => definition.chartId)).toEqual(expected.map(({ chartId }) => chartId));
});
