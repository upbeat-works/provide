import { expect, test, vi } from 'vitest';
import { graphParamsFor, EMBED_UID } from '$routes/(default)/projects/eu-scoreboard/components/charts/catalog.js';
import { getScoreboard } from '$routes/(default)/projects/eu-scoreboard/controller.js';
import { loadChart } from '$routes/(default)/projects/eu-scoreboard/controller.server.js';
import { load } from './+page.server.js';

vi.mock('$routes/(default)/projects/eu-scoreboard/controller.server.js', async (source) => {
  const actual = await source();
  return { ...actual, loadChart: vi.fn() };
});

test('loads the chart named by graph embed parameters', async () => {
  const scoreboard = getScoreboard('testing');
  const definition = scoreboard.charts[0];
  const selection = {
    scenario: { uid: '1.5C_SSP1' },
    region: { uid: 'European Union (R9)' },
    year: { uid: '2050' },
  };
  const params = new URLSearchParams(graphParamsFor(definition, 'testing', selection));
  expect(params.has('indicator')).toBe(false);
  const chart = { definition, status: 'ready', data: [] };
  loadChart.mockResolvedValue(chart);

  const data = await load({
    fetch: vi.fn(),
    params: { embed: EMBED_UID },
    url: new URL(`https://example.test/embed/${EMBED_UID}?${params}`),
  });

  expect(loadChart).toHaveBeenCalledWith(expect.objectContaining({ chartId: definition.chartId }));
  expect(data.scoreboardChart).toBe(chart);
});

test('loads canonical map availability for an image embed', async () => {
  const requestFetch = vi.fn(async () => Response.json({ scenarios: { 'Low Demand': [2030, 2050] } }));
  const url = new URL('https://example.test/embed/impact-geo?indicator=Mean%20Temperature&instance=provide-internal&geography=Cameroon&reference=2011-2020%20(Present%20Day)&time=Annual&spatial=Area&scenarios[0]=Low%20Demand&year=2050');
  const result = await load({ fetch: requestFetch, params: { embed: 'impact-geo' }, url });
  expect(result.mapView).toMatchObject({ status: 'ready', years: [2030, 2050], selection: { instance: 'provide-internal', scenarios: ['Low Demand'] } });
  const requested = new URL(requestFetch.mock.calls[0][0]);
  expect(requested.pathname).toBe('/api/impact-geo/availability/');
});

test('rejects an unsupported map threshold before loading availability', async () => {
  const requestFetch = vi.fn();
  const url = new URL('https://example.test/embed/impact-geo?indicator=Mean%20Temperature&instance=provide-internal&geography=Cameroon&reference=Present&time=Annual&spatial=Area&threshold=95th%20Percentile&scenarios[0]=Low%20Demand');
  const result = await load({ fetch: requestFetch, params: { embed: 'impact-geo' }, url });
  expect(result.mapView).toEqual({ status: 'empty' });
  expect(requestFetch).not.toHaveBeenCalled();
});
