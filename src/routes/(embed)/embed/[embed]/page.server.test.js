import { expect, test, vi } from 'vitest';
import { graphParamsFor, EMBED_UID } from '$routes/(default)/projects/eu-scoreboard/components/charts/catalog.js';
import { getScoreboard } from '$routes/(default)/projects/eu-scoreboard/controller.js';
import { loadCharts } from '$routes/(default)/projects/eu-scoreboard/controller.server.js';
import { load } from './+page.server.js';

vi.mock('$routes/(default)/projects/eu-scoreboard/controller.server.js', async (source) => {
  const actual = await source();
  return { ...actual, loadCharts: vi.fn() };
});

test('loads the chart named by graph embed parameters', async () => {
  const scoreboard = getScoreboard('testing');
  const definition = scoreboard.definitions[0];
  const selection = {
    scenario: { uid: '1.5C_SSP1' }, region: { uid: 'European Union (R9)' }, year: { uid: '2050' },
  };
  const params = new URLSearchParams(graphParamsFor(definition, 'testing', selection));
  const chart = { definition, status: 'ready', data: [] };
  loadCharts.mockResolvedValue({ charts: [chart], selection });

  const data = await load({
    fetch: vi.fn(), params: { embed: EMBED_UID },
    url: new URL(`https://example.test/embed/${EMBED_UID}?${params}`),
  });

  expect(loadCharts).toHaveBeenCalledWith(expect.objectContaining({ chartId: definition.chartId }));
  expect(data.scoreboardChart).toBe(chart);
});
