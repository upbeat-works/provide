import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let loadMethodologyScenarios;
let loadScoreboardChart;
let loadScoreboardMap;
let loadScoreboardDefinition;

afterEach(() => vi.unstubAllEnvs());

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', 'https://catalog.example/api');
  ({ loadMethodologyScenarios, loadScoreboardChart, loadScoreboardMap, loadScoreboardDefinition } = await import('./apis.js'));
});

describe('scoreboard loader', () => {
  it('loads definitions from the API with the requested topic and indicator', async () => {
    const definition = { sector: { uid: 'flood-risk', label: 'Flood risk' }, charts: [] };
    const fetch = vi.fn(async () => Response.json(definition));
    await expect(loadScoreboardDefinition(fetch, { sector: 'flood-risk', indicator: 'Flood days', year: 2050 })).resolves.toEqual(definition);
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.pathname).toBe('/api/scoreboard/definition/');
    expect(Object.fromEntries(url.searchParams)).toEqual({ sector: 'flood-risk', indicator: 'Flood days' });
  });

  it('sends only supplied selections and a chart limit', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ charts: [] })));
    await loadScoreboardChart(fetch, {
      sector: 'heat-stress',
      indicator: 'Maximum Air Temperature',
      scenario: 'CurrentPolicies',
      region: 'AT11',
      year: '2050',
      chartId: 'maximum-air-temperature-range',
    });

    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.pathname).toBe('/api/scoreboard/charts/maximum-air-temperature-range/');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sector: 'heat-stress',
      scenario: 'CurrentPolicies',
      region: 'AT11',
      year: '2050',
    });
  });

  it('includes the selected indicator only in map requests', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ status: 'ready', values: [] }));

    await loadScoreboardMap(fetch, {
      sector: 'testing',
      indicator: 'Mean Air Temperature',
      scenario: '1.5C',
      region: 'Austria',
      year: '2100',
    });

    const url = new URL(fetch.mock.calls[0][0]);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sector: 'testing',
      indicator: 'Mean Air Temperature',
      scenario: '1.5C',
      region: 'Austria',
      year: '2100',
    });
  });

  it('reports an HTTP status without putting the request URL in the error', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 502 }));
    const error = await loadScoreboardChart(fetch, { sector: 'testing' }).catch((error) => error);
    expect(error).toMatchObject({ status: 502 });
    expect(error.message).not.toContain('https://catalog.example');
  });
});

describe('methodology scenario loader', () => {
  it('requests one instance and exposes scenario years and uncertainty values', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'scenario',
            instance: 'sparccle-internal',
            yearStart: 2020,
            yearEnd: 2040,
            gmt: {
              yearStart: 2020,
              yearStep: 20,
              data: [
                [1, 2, 3],
                [2, 3, 4],
              ],
            },
            emissions: {
              unit: 'GtCO2eq/yr',
              data: [
                { year: 2020, value: 40 },
                { year: 2035, value: null },
                { year: 2040, value: -2 },
              ],
            },
          },
        ])
      )
    );
    const scenarios = await loadMethodologyScenarios(fetch, { instance: 'sparccle-internal' });
    expect(fetch.mock.calls[0][0]).toBe('https://catalog.example/api/methodology-scenarios/?instance=sparccle-internal');
    expect(scenarios[0]).toMatchObject({
      uid: 'scenario',
      instance: 'sparccle-internal',
      startYear: 2020,
      endYear: 2040,
      gmt: [
        { year: 2020, min: 1, value: 2, max: 3 },
        { year: 2040, min: 2, value: 3, max: 4 },
      ],
      emissions: [
        { year: 2020, value: 40 },
        { year: 2035, value: null },
        { year: 2040, value: -2 },
      ],
    });
  });

  it('requests the shared scenario catalog when no instance is given', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('[]'));
    expect(await loadMethodologyScenarios(fetch)).toEqual([]);
    expect(fetch.mock.calls[0][0]).toBe('https://catalog.example/api/methodology-scenarios/');
  });
});

it.each([
  ['scenario catalog', 30_000, (fetch) => loadMethodologyScenarios(fetch)],
  ['scoreboard chart', 60_000, (fetch) => loadScoreboardChart(fetch, { sector: 'testing', chartId: 'test' })],
])('bounds the full %s response', async (_label, deadline, load) => {
  vi.useFakeTimers();
  try {
    const fetch = vi.fn(async () => ({ ok: true, json: () => new Promise(() => {}) }));
    const result = load(fetch).catch((error) => error);
    await vi.advanceTimersByTimeAsync(deadline - 1);
    const { signal } = fetch.mock.calls[0][1];
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    expect(await result).toMatchObject({ name: 'TimeoutError' });
  } finally {
    vi.useRealTimers();
  }
});
