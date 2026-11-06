import { afterEach, expect, test, vi } from 'vitest';
import { scoreboard } from './scoreboard';
import * as platform from '../platform';

const definition = {
  chartId: 'custom-heat',
  title: 'Heat & exposure',
  description: 'A chart supplied by an embed URL.',
  chartType: 'bubble',
  data: {
    variables: ['Heat|Mean', 'Heat|High', 'Population|Exposed'],
    model: 'Custom model',
    unit: { x: '°C', y: '°C', size: 'people' },
    x: 'Mean', y: 'High', size: 'Exposed', riskFrom: 'size',
    groupBy: 'region', regions: ['Austria', 'France'],
  },
};
const selections = { scenario: 'Custom scenario', region: 'Germany', year: '2050' };
const post = (chart: unknown = definition, choices = selections) => scoreboard.request(`/charts?${new URLSearchParams(choices)}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chart),
}, { DB: {}, IXMP4_USERNAME: 'test', IXMP4_PASSWORD: 'test' } as never);

afterEach(() => vi.restoreAllMocks());

test('loads an unsaved chart with its roles, units, model and fixed regions', async () => {
  const values = { 'Heat|Mean': 12, 'Heat|High': 25, 'Population|Exposed': 100 };
  const tabulate = vi.fn(async (query) => ({
    columns: ['variable', 'scenario', 'region', 'model', 'unit', '2050'],
    values: query.region.name_in.map((region) => [query.variable.name, query.scenario.name, region, query.model.name, query.unit.name, values[query.variable.name]]),
  }));
  vi.spyOn(platform, 'createPlatform').mockResolvedValue({ iamc: { tabulate } } as never);

  const response = await post();

  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toMatchObject({
    definition, status: 'ready',
    series: [{ x: { unit: '°C' }, y: { unit: '°C' }, size: { unit: 'people' } }],
    data: [
      { region: { uid: 'Austria' }, series: [{ x: 12, y: 25, size: 100 }] },
      { region: { uid: 'France' }, series: [{ x: 12, y: 25, size: 100 }] },
    ],
  });
  expect(tabulate).toHaveBeenCalledTimes(3);
  for (const [query] of tabulate.mock.calls) {
    expect(query).toMatchObject({ scenario: { name: 'Custom scenario' }, region: { name_in: ['Austria', 'France'] }, model: { name: 'Custom model' }, stepYear: 2050 });
  }
});

test.each([
  ['object', null],
  ['chartId', { ...definition, chartId: '' }],
  ['title', { ...definition, title: '' }],
  ['variables', { ...definition, data: { variables: [1] } }],
  ['role', { ...definition, data: { ...definition.data, x: 'Missing' } }],
  ['type', { ...definition, chartType: 'unknown' }],
])('rejects an invalid %s before querying data', async (_, chart) => {
  const source = vi.spyOn(platform, 'createPlatform');
  const response = await post(chart);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: expect.any(String) });
  expect(source).not.toHaveBeenCalled();
});

test.each([
  { ...selections, scenario: '' },
  { ...selections, region: '' },
  { ...selections, year: 'invalid' },
])('rejects incomplete chart selections: %j', async (choices) => {
  const source = vi.spyOn(platform, 'createPlatform');
  const response = await post(definition, choices);
  expect(response.status).toBe(400);
  expect(source).not.toHaveBeenCalled();
});

test.each([
  ['regions', 'Austria'],
  ['regions', ['Austria', null]],
  ['regions', [' ']],
  ['regionLevel', 2],
  ['regionLevel', 'NUTS4'],
  ['regionLevel', null],
  ['aggregate', 'mean'],
])('reports invalid %s value %j as a config error before querying data', async (field, value) => {
  const tabulate = vi.fn(async () => ({ columns: ['variable', 'scenario', 'region', 'model', 'unit', '2050'], values: [] }));
  const source = vi.spyOn(platform, 'createPlatform').mockResolvedValue({ iamc: { tabulate } } as never);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const chart = { ...definition, data: { ...definition.data, regions: undefined, regionLevel: 'NUTS2', [field]: value } };
  const response = await post(chart);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: expect.stringContaining(field) });
  expect(source).not.toHaveBeenCalled();
});

test('reports source failures without exposing their details', async () => {
  vi.spyOn(platform, 'createPlatform').mockRejectedValue(new Error('Private source details'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = await post();
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: 'Chart data unavailable' });
});
