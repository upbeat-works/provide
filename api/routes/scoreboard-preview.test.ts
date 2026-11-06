import { afterEach, expect, test, vi } from 'vitest';
import { scoreboard } from './scoreboard';
import * as platform from '../platform';

const topic = {
  label: 'Draft heat',
  map: { indicators: [{ name: 'Heat', type: 'choropleth', europeLevel: 'NUTS0', level: 'NUTS2', variable: 'Draft variable' }], scenarios: [{ id: 'Draft scenario' }], years: [2050] },
  charts: [{ chartId: 'draft', title: 'Draft chart', description: '', chartType: 'line', data: { variables: ['Draft variable'] } }],
};
const post = (path, draft = topic) => scoreboard.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }, { DB: {}, IXMP4_USERNAME: 'test', IXMP4_PASSWORD: 'test' } as never);
afterEach(() => vi.restoreAllMocks());

test('previews an unsaved topic without changing the published definition', async () => {
  const before = await (await scoreboard.request('/definition')).json();
  const response = await post('/definition');
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ sector: { uid: 'preview', label: 'Draft heat' }, indicator: { variable: 'Draft variable' } });
  expect(await (await scoreboard.request('/definition')).json()).toEqual(before);
});

test('rejects invalid drafts before querying data', async () => {
  const source = vi.spyOn(platform, 'createPlatform');
  const response = await post('/charts/draft?scenario=Draft%20scenario&region=Austria&year=2050', { ...topic, map: { ...topic.map, years: [] } });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining('map.years') });
  expect(source).not.toHaveBeenCalled();
});

test.each(['/charts/draft', '/map?indicator=Heat&sector=preview'])('queries draft variables for %s', async (path) => {
  const tabulate = vi.fn(async (_query: unknown) => ({ columns: ['variable', 'scenario', 'region', 'model', 'unit', '2050'], values: [] }));
  vi.spyOn(platform, 'createPlatform').mockResolvedValue({ iamc: { tabulate } } as never);
  const separator = path.includes('?') ? '&' : '?';
  const response = await post(`${path}${separator}scenario=Draft%20scenario&region=Austria&year=2050`);
  expect(response.status).toBe(200);
  expect(tabulate).toHaveBeenCalled();
  expect(tabulate.mock.calls[0][0]).toMatchObject({ variable: { name: 'Draft variable' }, scenario: { name: 'Draft scenario' } });
});

test('selects the configured source unit when a variable has multiple units', async () => {
  const tabulate = vi.fn(async (query) => ({
    columns: ['variable', 'scenario', 'region', 'model', 'unit', '2050'],
    values: ['days/yr', '°C'].filter((unit) => !query.unit || query.unit.name === unit).map((unit) =>
      ['Draft variable', 'Draft scenario', 'Austria', 'Model', unit, 12]),
  }));
  vi.spyOn(platform, 'createPlatform').mockResolvedValue({ iamc: { tabulate } } as never);
  const draft = { ...topic, charts: [{ ...topic.charts[0], data: { variables: ['Draft variable'], unit: 'days/yr' } }] };
  const response = await post('/charts/draft?scenario=Draft%20scenario&region=Austria&year=2050', draft);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'ready', series: [{ line: { unit: 'days/yr' } }], data: [{ line: [{ year: 2050, value: 12 }] }] });
  expect(tabulate).toHaveBeenCalledWith(expect.objectContaining({ unit: { name: 'days/yr' } }));
});

test.each([
  ['Austria', undefined, 'AT11'],
  ['all', undefined, 'Austria'],
  ['all', 'sum', 'Austria'],
])('selects the map unit for %s with aggregation %s', async (region, aggregate, expectedRegion) => {
  const tabulate = vi.fn(async (query) => {
    const sourceRegion = query.region.name_in.includes('AT11') ? 'AT11' : 'Austria';
    return {
      columns: ['variable', 'scenario', 'region', 'model', 'unit', '2050'],
      values: ['days/yr', '°C'].filter((unit) => !query.unit || query.unit.name === unit).map((unit) =>
        ['Draft variable', 'Draft scenario', sourceRegion, 'Model', unit, 12]),
    };
  });
  vi.spyOn(platform, 'createPlatform').mockResolvedValue({ iamc: { tabulate } } as never);
  const draft = { ...topic, map: { ...topic.map, indicators: [{ ...topic.map.indicators[0], unit: 'days/yr', aggregate }] } };
  const response = await post(`/map?sector=preview&indicator=Heat&scenario=Draft%20scenario&region=${region}&year=2050`, draft);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'ready', metadata: { unit: 'days/yr' }, values: [{ region: expectedRegion, value: 12 }] });
  expect(tabulate).toHaveBeenCalledWith(expect.objectContaining({ unit: { name: 'days/yr' } }));
});

test.each([
  ['NUTS0', 'all', 'Austria', 'France'],
  ['NUTS2', 'all', 'AT11', 'FR10'],
  ['NUTS3', 'all', 'AT111', 'FR101'],
  ['NUTS3', 'Austria', 'AT11', undefined],
])('uses Europe level %s for %s without changing country detail', async (europeLevel, region, expectedRegion, otherRegion) => {
  const tabulate = vi.fn(async (query) => ({
    columns: ['variable', 'scenario', 'region', 'model', 'unit', '2050'],
    values: query.region.name_in.includes(expectedRegion)
      ? [['Draft variable', 'Draft scenario', expectedRegion, 'Model', 'days/yr', 12]] : [],
  }));
  vi.spyOn(platform, 'createPlatform').mockResolvedValue({ iamc: { tabulate } } as never);
  const draft = { ...topic, map: { ...topic.map, indicators: [{ ...topic.map.indicators[0], europeLevel, unit: 'days/yr' }] } };
  const response = await post(`/map?sector=preview&indicator=Heat&scenario=Draft%20scenario&region=${region}&year=2050`, draft);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'ready', values: [{ region: expectedRegion, value: 12 }] });
  const query = tabulate.mock.calls[0][0];
  expect(query.unit).toEqual({ name: 'days/yr' });
  if (otherRegion) expect(query.region.name_in).toContain(otherRegion);
  else expect(query.region.name_in.every((id) => id.startsWith('AT'))).toBe(true);
});

test('does not aggregate Europe regions into countries when a regional Europe level is set', async () => {
  const tabulate = vi.fn(async () => ({
    columns: ['variable', 'scenario', 'region', 'model', 'unit', '2050'],
    values: [['Draft variable', 'Draft scenario', 'AT11', 'Model', 'people', 12]],
  }));
  vi.spyOn(platform, 'createPlatform').mockResolvedValue({ iamc: { tabulate } } as never);
  const draft = { ...topic, map: { ...topic.map, indicators: [{ ...topic.map.indicators[0], europeLevel: 'NUTS2', aggregate: 'sum' }] } };
  const response = await post('/map?sector=preview&indicator=Heat&scenario=Draft%20scenario&region=all&year=2050', draft);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ values: [{ region: 'AT11', value: 12 }] });
});

test.each([undefined, 'NUTS1', 'NUTS4', 'countries'])('rejects unsupported Europe level %s before querying data', async (europeLevel) => {
  const source = vi.spyOn(platform, 'createPlatform');
  const draft = { ...topic, map: { ...topic.map, indicators: [{ ...topic.map.indicators[0], europeLevel }] } };
  const response = await post('/map?sector=preview&indicator=Heat&scenario=Draft%20scenario&region=all&year=2050', draft);
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining('europeLevel') });
  expect(source).not.toHaveBeenCalled();
});
