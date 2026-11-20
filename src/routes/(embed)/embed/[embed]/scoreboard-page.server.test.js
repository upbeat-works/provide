// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { Hono } from 'hono';
import { stringify } from 'qs';
import { safeCaseStudyEmbedUrl } from '$lib/catalog/case-study-embed-url.js';
import { scoreboard } from '../../../../../api/routes/scoreboard';
import { getTestScoreboard as getScoreboard } from '../../../../../test/fixtures/scoreboard.js';
import * as platform from '../../../../../api/platform';
import { graphParamsFor, EMBED_UID } from '$routes/(default)/impacts/eu-scoreboard/components/charts/catalog.js';
import { load } from './+page.server.js';

const definition = {
  chartId: 'custom-temperature', title: 'Temperature & heat', description: 'Custom temperature range in °C.', chartType: 'line_with_range',
  data: { variables: ['Temperature|Mean', 'Temperature|Low', 'Temperature|High'], line: 'Mean', rangeLow: 'Low', rangeHigh: 'High', unit: '°C' },
};
const selections = { scenario: 'Custom scenario', region: 'Austria', year: '2050' };
const api = new Hono({ strict: false }).route('/api/scoreboard', scoreboard);
function requestFetch(input, init) {
  const url = new URL(input, 'https://example.test');
  return api.request(`${url.pathname}${url.search}`, init, { DB: {}, IXMP4_USERNAME: 'test', IXMP4_PASSWORD: 'test' });
}
const queryOptions = { arrayFormat: 'comma', commaRoundTrip: true, encodeValuesOnly: true };
const embedUrl = (query = {}) => new URL(`https://example.test/embed/${EMBED_UID}?${stringify({ chart: definition, ...selections, ...query }, queryOptions)}`);

afterEach(() => vi.restoreAllMocks());

function source(values = { 'Temperature|Mean': 12, 'Temperature|Low': 8, 'Temperature|High': 18 }) {
  const tabulate = vi.fn(async (query) => ({
    columns: ['variable', 'scenario', 'region', 'model', 'unit', '2040', '2050'],
    values: [[query.variable.name, query.scenario.name, 'Austria', 'Model', '°C', values[query.variable.name] - 1, values[query.variable.name]]],
  }));
  vi.spyOn(platform, 'createPlatform').mockResolvedValue({ iamc: { tabulate } });
  return tabulate;
}

test('loads the full chart definition from a URL without a saved topic', async () => {
  const tabulate = source();
  const fetch = vi.fn(requestFetch);
  const data = await load({ fetch, params: { embed: EMBED_UID }, url: embedUrl() });
  expect(data.scoreboardChart).toMatchObject({
    definition, status: 'ready',
    data: [{ line: [{ year: 2040, value: 11 }, { year: 2050, value: 12 }], rangeLow: [{ year: 2040, value: 7 }, { year: 2050, value: 8 }] }],
  });
  expect(data.selection).toEqual(Object.fromEntries(Object.entries(selections).map(([key, uid]) => [key, { uid, label: uid }])));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(tabulate).toHaveBeenCalledTimes(3);
});

test('loads a scoreboard export from its definition without a topic lookup', async () => {
  const definition = getScoreboard('testing').charts[0];
  source({ [definition.data.variables[0]]: 12 });
  const fetch = vi.fn(requestFetch);
  const selection = Object.fromEntries(Object.entries(selections).map(([key, uid]) => [key, { uid }]));
  const query = stringify(graphParamsFor(definition, selection), queryOptions);
  const data = await load({ fetch, params: { embed: EMBED_UID }, url: new URL(`https://example.test/embed/${EMBED_UID}?${query}`) });
  expect(data.scoreboardChart).toMatchObject({ definition, status: 'ready', data: [{ line: [{ year: 2040, value: 11 }, { year: 2050, value: 12 }] }] });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('keeps a custom chart definition when building its image export URL', async () => {
  source();
  const selection = Object.fromEntries(Object.entries(selections).map(([key, uid]) => [key, { uid }]));
  const query = stringify({ ...graphParamsFor(definition, selection), static: 'true' }, queryOptions);
  const data = await load({ fetch: requestFetch, params: { embed: EMBED_UID }, url: new URL(`https://example.test/embed/${EMBED_UID}?${query}`) });
  expect(data.scoreboardChart).toMatchObject({ definition, status: 'ready' });
});

test.each(['invalid', { ...definition, data: { ...definition.data, rangeLow: 'Missing' } }])('rejects an invalid chart definition: %j', async (chart) => {
  const fetch = vi.fn(requestFetch);
  const source = vi.spyOn(platform, 'createPlatform');
  await expect(load({ fetch, params: { embed: EMBED_UID }, url: embedUrl({ chart }) })).rejects.toMatchObject({ status: 400 });
  expect(source).not.toHaveBeenCalled();
});

test.each([{ scenario: '' }, { region: '' }, { year: 'bad' }])('does not query data when chart selections are incomplete: %j', async (query) => {
  const fetch = vi.fn(requestFetch);
  const data = await load({ fetch, params: { embed: EMBED_UID }, url: embedUrl(query) });
  expect(data.scoreboardChart).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});

test.each([
  ['regions', { groupBy: 'region', regions: 'Austria' }],
  ['regionLevel', { groupBy: 'region', regionLevel: 2 }],
])('rejects an invalid %s in the widget URL before making a request', async (field, grouping) => {
  const fetch = vi.fn(requestFetch);
  const chart = { ...definition, data: { ...definition.data, ...grouping } };
  await expect(load({ fetch, params: { embed: EMBED_UID }, url: embedUrl({ chart }) })).rejects.toMatchObject({
    status: 400, body: { message: expect.stringContaining(field) },
  });
  expect(fetch).not.toHaveBeenCalled();
});

test('reports an incomplete URL when the chart definition is missing', async () => {
  const url = embedUrl({ chart: undefined });
  const fetch = vi.fn(requestFetch);
  const data = await load({ fetch, params: { embed: EMBED_UID }, url });
  expect(data.scoreboardChart).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});

test('returns a chart error that can be retried when the source fails', async () => {
  vi.spyOn(platform, 'createPlatform').mockRejectedValue(new Error('Private source details'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const data = await load({ fetch: requestFetch, params: { embed: EMBED_UID }, url: embedUrl() });
  expect(data.scoreboardChart).toMatchObject({ definition, status: 'error', error: 'Chart data could not be loaded.' });
});

test.each([[0, false], [3, true]])('keeps decimal precision %i and Europe visibility %s in an exported chart', async (decimals, hideInEuropeView) => {
  source();
  const chart = { ...definition, chartId: '001', description: '', decimals, hideInEuropeView };
  const selection = Object.fromEntries(Object.entries(selections).map(([key, uid]) => [key, { uid }]));
  const query = stringify(graphParamsFor(chart, selection), queryOptions);
  const url = new URL(`https://example.test/embed/${EMBED_UID}?${query}`);
  const data = await load({ fetch: requestFetch, params: { embed: EMBED_UID }, url });
  expect(data.scoreboardChart).toMatchObject({ definition: chart, status: 'ready' });
});

test('loads every variable and fixed region from a long chart definition', async () => {
  const variables = Array.from({ length: 25 }, (_, index) => `Temperature|${index}`);
  const regions = ['Austria', ...Array.from({ length: 24 }, (_, index) => `Region ${index}`)];
  const chart = { ...definition, chartType: 'line', data: { variables, groupBy: 'region', regions } };
  const tabulate = source(Object.fromEntries(variables.map((variable) => [variable, 12])));
  const data = await load({ fetch: requestFetch, params: { embed: EMBED_UID }, url: embedUrl({ chart }) });
  expect(data.scoreboardChart).toMatchObject({ definition: chart, status: 'ready' });
  expect(tabulate).toHaveBeenCalledTimes(variables.length);
  expect(tabulate.mock.calls.map(([query]) => query.variable.name)).toEqual(variables);
  expect(tabulate.mock.calls[0][0].region.name_in).toEqual(regions);
});

test.each([
  { variables: ['Temperature|Mean, annual'] },
  { variables: ['Temperature|Mean, annual', 'Temperature|High'] },
])('keeps commas inside names when a chart link is saved in a case study: $variables', async ({ variables }) => {
  const chart = {
    ...definition,
    chartType: 'line',
    description: 'Heat, exposure & risk + uncertainty',
    data: { variables, groupBy: 'region', regions: ['Austria', 'Belgium, Region'] },
  };
  const tabulate = source(Object.fromEntries(variables.map((variable) => [variable, 12])));
  const path = safeCaseStudyEmbedUrl(embedUrl({ chart }).href);
  const url = new URL(path, 'https://example.test');
  const data = await load({ fetch: requestFetch, params: { embed: EMBED_UID }, url });
  expect(data.scoreboardChart).toMatchObject({ definition: chart, status: 'ready' });
  expect(tabulate.mock.calls.map(([query]) => query.variable.name)).toEqual(variables);
});

test.each([
  { decimals: '' },
  { decimals: 'invalid' },
  { decimals: '2.5' },
  { hideInEuropeView: 'invalid' },
])('rejects invalid chart options before querying data: %j', async (options) => {
  const fetch = vi.fn(requestFetch);
  const chart = { ...definition, ...options };
  await expect(load({ fetch, params: { embed: EMBED_UID }, url: embedUrl({ chart }) })).rejects.toMatchObject({ status: 400 });
  expect(fetch).not.toHaveBeenCalled();
});
