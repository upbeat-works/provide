import { afterEach, expect, test, vi } from 'vitest';
import * as platformModule from '../platform';
import * as controller from '../scoreboard/controller.js';

afterEach(() => vi.restoreAllMocks());

test('loads a configured chart with source units through the request boundary', async () => {
  const config = {
    chartId: 'example', chartType: 'scatter',
    data: { groupBy: 'region', regions: ['Region A'], variables: ['Low', 'High'], unitFallback: 'people', x: 'Low', y: 'High' },
  };
  vi.spyOn(controller, 'getScoreboard').mockReturnValue({ charts: [config] } as never);
  const tabulate = vi.fn(async (query) => ({
    columns: ['variable', 'scenario', 'region', 'model', 'unit', '2050'],
    values: [[query.variable.name, query.scenario.name, 'Region A', 'Model', 'thousand people', query.variable.name === 'Low' ? 2 : 5]],
  }));
  vi.spyOn(platformModule, 'createPlatform').mockResolvedValue({ iamc: { tabulate } } as never);
  const { api } = await import('../index');
  const response = await api.request('/api/scoreboard/charts/example?sector=example&scenario=Scenario%20B&region=Austria&year=2050', {}, {
    IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'secret', DB: {} as never,
  });

  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toMatchObject({ status: 'ready', data: [{ region: { uid: 'Region A' }, series: [{ x: 2, y: 5 }] }] });
  expect(result.series[0]).toMatchObject({ x: { unit: 'thousand people' }, y: { unit: 'thousand people' } });
  for (const [query] of tabulate.mock.calls) {
    expect(query).toMatchObject({ scenario: { name: 'Scenario B' }, stepYear: 2050, region: { name_in: ['Region A'] } });
    expect(query).not.toHaveProperty('unit');
    expect(query).not.toHaveProperty('model');
  }
});
