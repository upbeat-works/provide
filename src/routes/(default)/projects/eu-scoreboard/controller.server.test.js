import { beforeEach, expect, test, vi } from 'vitest';
import { loadFromStrapi, loadScoreboardOptions, loadScoreboardChart, loadScoreboardMap } from '$utils/apis.js';
import { loadOptions, loadChart, loadMap } from './controller.server.js';
import { getScoreboard } from './controller.js';
import { resolveSelection } from './selection.js';
import { load as loadRanking } from './+page.server.js';
import { load as loadIndicators } from './indicators/+page.js';
vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$utils/apis.js', () => ({ loadScoreboardOptions: vi.fn(), loadScoreboardChart: vi.fn(), loadScoreboardMap: vi.fn(), loadFromStrapi: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const scoreboard = getScoreboard('testing');
const selections = { scenario: 'CurrentPolicies', region: 'Austria', year: '2050' };
const option = (uid) => ({ uid, label: uid });
const options = {
  status: 'ready',
  scenarios: [option('CurrentPolicies')],
  regions: [option('Austria')],
  years: [option('2050')],
  selection: { scenario: option('CurrentPolicies'), region: option('Austria') },
};

test('keeps URL choices pending when options fail', async () => {
  loadScoreboardOptions.mockRejectedValue(new Error('private details'));
  const result = await loadOptions({ scoreboard, fetch: vi.fn(), selections });
  expect(result.status).toBe('error');
  expect(resolveSelection(result, selections)).toEqual({ scenario: option('CurrentPolicies'), region: option('Austria'), year: option('2050') });
  expect(result.error).not.toContain('private');
});

test('replaces an invalid year only after successful availability', () => {
  expect(resolveSelection(options, { ...selections, year: '2070' }).year).toEqual(option('2050'));
});

test('keeps the requested year when only year discovery failed', () => {
  expect(resolveSelection({ ...options, yearStatus: 'error' }, { ...selections, year: '2070' }).year).toEqual(option('2070'));
});

test('ranking loads no chart or map values', async () => {
  await loadRanking({ fetch: vi.fn(), parent: async () => ({ scoreboard, scoreboardOptions: options }), url: new URL('https://example.test/?sector=testing') });
  expect(loadScoreboardOptions).not.toHaveBeenCalled();
  expect(loadScoreboardChart).not.toHaveBeenCalled();
  expect(loadScoreboardMap).not.toHaveBeenCalled();
});

test('returns map and chart promises without waiting for a slow chart', async () => {
  let finish;
  const slow = new Promise((resolve) => {
    finish = resolve;
  });
  const fetcher = vi.fn(async (path) => {
    if (path.includes(`/charts/${scoreboard.definitions[0].chartId}?`)) return slow;
    if (path.includes('/map?')) return Response.json({ status: 'ready', values: [{ uid: 'AUT', value: 0 }] });
    return Response.json({ status: 'empty', data: [] });
  });
  const result = await loadIndicators({ fetch: fetcher, parent: async () => ({ scoreboard, scoreboardOptions: options, selection: resolveSelection(options, selections) }) });
  expect(loadScoreboardOptions).not.toHaveBeenCalled();
  expect(await result.map).toMatchObject({ status: 'ready' });
  expect(await result.charts[1].result).toMatchObject({ status: 'empty' });
  finish(Response.json({ status: 'ready', data: [] }));
  expect(await result.charts[0].result).toMatchObject({ status: 'ready' });
});

test('chart and map errors stay inside their own result', async () => {
  loadScoreboardChart.mockRejectedValue(new Error('private details'));
  loadScoreboardMap.mockResolvedValue({ status: 'ready', values: [] });
  expect(await loadChart({ scoreboard, chartId: scoreboard.definitions[0].chartId, selections, fetch: vi.fn() })).toMatchObject({ status: 'error', data: [] });
  expect(await loadMap({ scoreboard, selections, fetch: vi.fn() })).toMatchObject({ status: 'ready' });
});

test('requests only the linked case study and keeps the chart if the CMS fails', async () => {
  const definition = { ...scoreboard.definitions[0], caseStudyId: '23' };
  const chart = { definition, status: 'ready', data: [] };
  loadScoreboardChart.mockResolvedValue(chart);
  loadFromStrapi.mockRejectedValue(new Error('CMS unavailable'));
  const result = await loadChart({ scoreboard: { ...scoreboard, definitions: [definition] }, chartId: definition.chartId, selections, fetch: vi.fn() });
  expect(result).toEqual(chart);
  expect(loadFromStrapi).toHaveBeenCalledWith('case-study-dynamics', expect.any(Function), expect.any(String), 'filters[id][$eq]=23');
});
