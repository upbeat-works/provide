import { beforeEach, expect, test, vi } from 'vitest';
import { loadFromStrapi, loadScoreboardChart, loadScoreboardMap } from '$utils/apis.js';
import { loadChart, loadMap, selectionsFromUrl } from './controller.server.js';
import { getScoreboard } from './controller.js';

vi.mock('$utils/apis.js', () => ({ loadScoreboardChart: vi.fn(), loadScoreboardMap: vi.fn(), loadFromStrapi: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

const scoreboard = getScoreboard('testing', 'Mean Air Temperature');
const selections = { indicator: 'Mean Air Temperature', scenario: 'CurrentPolicies', region: 'Austria', year: '2050' };

test('loads the selected indicator map', async () => {
  const ready = { definition: scoreboard.indicator, status: 'ready', values: [] };
  loadScoreboardMap.mockResolvedValue(ready);

  await expect(loadMap({ scoreboard, selections, fetch: vi.fn() })).resolves.toBe(ready);
  expect(loadScoreboardMap).toHaveBeenCalledWith(expect.any(Function), { sector: 'testing', ...selections });
});

test('keeps chart and map failures inside their own result', async () => {
  loadScoreboardChart.mockRejectedValue(new Error('private chart details'));
  loadScoreboardMap.mockRejectedValue(new Error('private map details'));

  await expect(loadChart({ scoreboard, chartId: scoreboard.charts[0].chartId, selections, fetch: vi.fn() })).resolves.toMatchObject({
    definition: scoreboard.charts[0],
    status: 'error',
    data: [],
    error: 'Chart data could not be loaded.',
  });
  await expect(loadMap({ scoreboard, selections, fetch: vi.fn() })).resolves.toMatchObject({
    definition: scoreboard.indicator,
    status: 'error',
    values: [],
    error: 'Map data could not be loaded.',
  });
});

test('does not load an unknown chart', async () => {
  await expect(loadChart({ scoreboard, chartId: 'unknown', selections, fetch: vi.fn() })).resolves.toBeUndefined();
  expect(loadScoreboardChart).not.toHaveBeenCalled();
});

test('requests only the linked case study and keeps the chart if the CMS fails', async () => {
  const definition = { ...scoreboard.charts[0], caseStudyId: '23' };
  const chart = { definition, status: 'ready', data: [] };
  loadScoreboardChart.mockResolvedValue(chart);
  loadFromStrapi.mockRejectedValue(new Error('CMS unavailable'));

  const result = await loadChart({ scoreboard: { ...scoreboard, charts: [definition] }, chartId: definition.chartId, selections, fetch: vi.fn() });

  expect(result).toEqual(chart);
  expect(loadFromStrapi).toHaveBeenCalledWith('case-study-dynamics', expect.any(Function), expect.any(String), 'filters[id][$eq]=23');
});

test('reads the map indicator with the shared chart choices', () => {
  const url = new URL(
    'https://example.test/app/scoreboard/map?indicator=Mean%20Air%20Temperature&scenario=CurrentPolicies&region=Austria&year=2050'
  );

  expect(selectionsFromUrl(url)).toEqual(selections);
});

test('returns an unavailable map for a charts-only sector without an upstream request', async () => {
  const chartsOnly = { ...scoreboard, indicator: undefined };

  await expect(loadMap({ scoreboard: chartsOnly, selections, fetch: vi.fn() })).resolves.toEqual({ status: 'unavailable', values: [], metadata: null });
  expect(loadScoreboardMap).not.toHaveBeenCalled();
});

test('uses the configured map indicator when the request omits it', async () => {
  const configured = { sector: { uid: 'example' }, indicator: { name: 'Population' } };
  const fetch = vi.fn();
  const choices = { scenario: 'Scenario B', region: 'Austria', year: '2050' };
  loadScoreboardMap.mockResolvedValue({ status: 'ready', values: [{ region: 'AT11', value: 12 }] });

  await expect(loadMap({ scoreboard: configured, selections: choices, fetch })).resolves.toMatchObject({ status: 'ready' });
  expect(loadScoreboardMap).toHaveBeenCalledWith(fetch, {
    sector: 'example', indicator: 'Population', ...choices,
  });
});
