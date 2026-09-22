import { expect, test, vi } from 'vitest';
import { getScoreboard } from '../controller.js';
import { load } from './+page.js';

vi.mock('$app/environment', () => ({ browser: true }));

const option = (uid) => ({ uid, label: uid });
const scoreboard = getScoreboard('testing', 'Mean Air Temperature');
const selection = {
  indicator: option('Mean Air Temperature'),
  scenario: option('CurrentPolicies'),
  region: option('Austria'),
  year: option('2050'),
};

test('starts map and chart requests independently with their required choices', async () => {
  let finishFirstChart;
  const firstChart = new Promise((resolve) => {
    finishFirstChart = resolve;
  });
  const fetch = vi.fn(async (path) => {
    if (path.includes(`/charts/${scoreboard.charts[0].chartId}?`)) return firstChart;
    if (path.includes('/map?')) return Response.json({ definition: scoreboard.indicator, status: 'ready', values: [] });
    return Response.json({ status: 'empty', data: [] });
  });

  const result = await load({ fetch, parent: async () => ({ scoreboard, selection }) });

  await expect(result.map).resolves.toMatchObject({ status: 'ready' });
  await expect(result.charts[1].result).resolves.toMatchObject({ status: 'empty' });
  const mapUrl = new URL(fetch.mock.calls.find(([path]) => path.includes('/map?'))[0], 'https://example.test');
  expect(mapUrl.searchParams.get('indicator')).toBe('Mean Air Temperature');
  const chartUrl = new URL(fetch.mock.calls.find(([path]) => path.includes('/charts/'))[0], 'https://example.test');
  expect(chartUrl.searchParams.has('indicator')).toBe(false);

  finishFirstChart(Response.json({ status: 'ready', data: [] }));
  await expect(result.charts[0].result).resolves.toMatchObject({ status: 'ready' });
});
