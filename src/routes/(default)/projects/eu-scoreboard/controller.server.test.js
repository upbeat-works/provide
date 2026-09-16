import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadFromStrapi, loadScoreboard } from '$utils/apis.js';
import { loadCharts } from './controller.server.js';

vi.mock('$utils/apis.js', () => ({ loadFromStrapi: vi.fn(), loadScoreboard: vi.fn() }));

let errorLog;
beforeEach(() => {
  vi.resetAllMocks();
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});

const scoreboard = {
  sector: { uid: 'testing', label: 'Testing' },
  definitions: [{ chartId: 'chart', chartType: 'line', caseStudyId: 'study-1', data: { series: [] } }],
};

const result = {
  scenarios: [], regions: [], years: [], selection: {},
  map: undefined,
  charts: [{ definition: scoreboard.definitions[0], status: 'empty', data: [] }],
};

describe('scoreboard page loading', () => {
  it('passes URL selections to the scoreboard endpoint and resolves configured case studies', async () => {
    loadScoreboard.mockResolvedValue(result);
    loadFromStrapi.mockResolvedValue([{ id: 'study-1', attributes: { Slug: 'study' } }]);

    const loaded = await loadCharts({
      scoreboard,
      fetch: vi.fn(),
      selections: { scenario: 'scenario', region: 'region', year: '2050' },
    });

    expect(loadScoreboard).toHaveBeenCalledWith(expect.any(Function), {
      sector: 'testing', scenario: 'scenario', region: 'region', year: '2050',
    });
    expect(loaded.charts[0].caseStudy.slug).toBe('study');
  });

  it('does not request CMS content when no chart refers to a case study', async () => {
    loadScoreboard.mockResolvedValue({
      ...result,
      charts: [{ ...result.charts[0], definition: { chartId: 'chart', chartType: 'line', data: { series: [] } } }],
    });
    const loaded = await loadCharts({ scoreboard, fetch: vi.fn(), selections: {} });
    expect(loadFromStrapi).not.toHaveBeenCalled();
    expect(loaded.charts[0].caseStudy).toBeUndefined();
  });

  it('keeps chart data when optional case-study content is unavailable', async () => {
    loadScoreboard.mockResolvedValue(result);
    loadFromStrapi.mockRejectedValue(new Error('CMS unavailable'));
    const loaded = await loadCharts({ scoreboard, fetch: vi.fn(), selections: {} });
    expect(loaded.charts[0]).toMatchObject({ status: 'empty', data: [] });
    expect(loaded.charts[0].caseStudy).toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith('Scoreboard case studies failed', expect.objectContaining({
      operation: 'load-case-studies', sector: 'testing', caseStudyIds: ['study-1'], reasonName: 'Error',
    }));
  });

  it('returns visible chart errors when the scoreboard request fails', async () => {
    const failure = new Error('https://internal.example/api/scoreboard/?token=secret → HTTP 503');
    failure.cause = Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' });
    loadScoreboard.mockRejectedValue(failure);
    const loaded = await loadCharts({ scoreboard, fetch: vi.fn() });
    expect(loaded.charts).toEqual([
      { definition: scoreboard.definitions[0], status: 'error', data: [], error: 'Chart data could not be loaded.' },
    ]);
    expect(errorLog).toHaveBeenCalledWith('Scoreboard request failed', {
      operation: 'load-scoreboard', sector: 'testing', chartId: undefined,
      scenario: undefined, region: undefined, year: undefined,
      reasonName: 'Error', causeName: 'Error', causeCode: 'ECONNREFUSED', reasonStatus: 503,
    });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('secret');
  });

  it('loads a configured map when the sector has no charts', async () => {
    const mapDefinition = {
      title: 'Maximum air temperature', geographyType: 'admin0',
      data: { variable: 'Temperature', model: 'Model', unit: '°C' },
    };
    const map = { definition: mapDefinition, status: 'empty', values: [] };
    loadScoreboard.mockResolvedValue({
      scenarios: [], regions: [], years: [], selection: {}, map, charts: [],
    });
    const loaded = await loadCharts({
      scoreboard: { sector: { uid: 'heat-stress' }, definitions: [], mapDefinition },
      fetch: vi.fn(),
    });
    expect(loadScoreboard).toHaveBeenCalledWith(expect.any(Function), { sector: 'heat-stress' });
    expect(loaded.map).toBe(map);
  });

  it('returns a retryable map error when a map-only request fails', async () => {
    const mapDefinition = {
      title: 'Maximum air temperature', geographyType: 'admin0',
      data: { variable: 'Temperature', model: 'Model', unit: '°C' },
    };
    loadScoreboard.mockRejectedValue(new Error('Unavailable'));
    const loaded = await loadCharts({
      scoreboard: { sector: { uid: 'heat-stress' }, definitions: [], mapDefinition },
      fetch: vi.fn(),
    });
    expect(loaded.map).toEqual({
      definition: mapDefinition, status: 'error', values: [], error: 'Map data could not be loaded.',
    });
    expect(loaded.charts).toEqual([]);
  });
});
