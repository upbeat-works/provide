import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let loadMethodologyScenarios;
let loadScoreboard;

afterEach(() => vi.unstubAllEnvs());

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', 'https://catalog.example/api');
  ({ loadMethodologyScenarios, loadScoreboard } = await import('./apis.js'));
});

describe('scoreboard loader', () => {
  it('sends only supplied selections and a chart limit', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ charts: [] })));
    await loadScoreboard(fetch, {
      sector: 'heat-stress',
      scenario: 'CurrentPolicies',
      region: 'AT11',
      year: '2050',
      chartId: 'maximum-air-temperature-range',
    });

    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.pathname).toBe('/api/scoreboard/');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sector: 'heat-stress',
      scenario: 'CurrentPolicies',
      region: 'AT11',
      year: '2050',
      chartId: 'maximum-air-temperature-range',
    });
  });

  it('reports an HTTP status without putting the request URL in the error', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 502 }));
    await expect(loadScoreboard(fetch, { sector: 'testing' })).rejects.toMatchObject({
      message: 'Request failed', status: 502,
    });
  });
});

describe('methodology scenario loader', () => {
  it('requests one instance and exposes scenario years and uncertainty values', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: 'scenario', instance: 'sparccle-internal', yearStart: 2020, yearEnd: 2040,
      gmt: { yearStart: 2020, yearStep: 20, data: [[1, 2, 3], [2, 3, 4]] },
    }])));
    const scenarios = await loadMethodologyScenarios(fetch, { instance: 'sparccle-internal' });
    expect(fetch).toHaveBeenCalledWith('https://catalog.example/api/methodology-scenarios/?instance=sparccle-internal');
    expect(scenarios[0]).toMatchObject({
      uid: 'scenario', instance: 'sparccle-internal', startYear: 2020, endYear: 2040,
      gmt: [{ year: 2020, min: 1, value: 2, max: 3 }, { year: 2040, min: 2, value: 3, max: 4 }],
    });
  });

  it('requests the shared scenario catalog when no instance is given', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('[]'));
    expect(await loadMethodologyScenarios(fetch)).toEqual([]);
    expect(fetch).toHaveBeenCalledWith('https://catalog.example/api/methodology-scenarios/');
  });
});
