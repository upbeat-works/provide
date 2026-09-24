import { beforeEach, expect, test, vi } from 'vitest';
import { loadChart, loadMap } from '$routes/(default)/impacts/eu-scoreboard/controller.server.js';
import { GET as getMap } from './map/+server.js';
import { GET as getChart } from './charts/[chartId]/+server.js';

vi.mock('$routes/(default)/impacts/eu-scoreboard/controller.server.js', async (source) => {
  const actual = await source();
  return { ...actual, loadMap: vi.fn(), loadChart: vi.fn() };
});

beforeEach(() => vi.resetAllMocks());

test('uses the URL indicator for the same-origin map request', async () => {
  loadMap.mockResolvedValue({ status: 'ready', values: [] });
  const url = new URL(
    'https://example.test/app/scoreboard/map?sector=testing&indicator=Mean%20Air%20Temperature&scenario=1.5C&region=Austria&year=2050'
  );

  await getMap({ fetch: vi.fn(), url });

  expect(loadMap).toHaveBeenCalledWith(
    expect.objectContaining({
      scoreboard: expect.objectContaining({ indicator: expect.objectContaining({ name: 'Mean Air Temperature' }) }),
      selections: { indicator: 'Mean Air Temperature', scenario: '1.5C', region: 'Austria', year: '2050' },
    })
  );
});

test('loads a same-origin chart without an indicator parameter', async () => {
  loadChart.mockResolvedValue({ status: 'ready', data: [] });
  const url = new URL('https://example.test/app/scoreboard/charts/test?sector=testing&scenario=1.5C&region=Austria&year=2050');

  const response = await getChart({ fetch: vi.fn(), url, params: { chartId: 'test' } });

  expect(response.status).toBe(200);
  expect(loadChart).toHaveBeenCalledWith(
    expect.objectContaining({ selections: { indicator: undefined, scenario: '1.5C', region: 'Austria', year: '2050' } })
  );
});
