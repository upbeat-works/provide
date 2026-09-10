import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer();
let errorLog;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  vi.stubEnv('SSR', true);
  vi.stubEnv('VITE_API_URL', 'https://public-api.example/api');
  vi.stubEnv('VITE_API_URL_INTERNAL', 'https://catalog-api.example/api');
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

afterAll(() => server.close());

const indicatorDetails = {
  id: 'Heat / wet days?',
  instance: 'provide internal/blue',
  unit: 'days',
  parameters: [
    {
      id: 'time',
      label: 'Time',
      options: [{ id: 'Annual', label: 'Annual' }],
    },
  ],
  models: ['ISIMIP'],
  sources: ['DOI:10.1000/example'],
  ixmp4Description: 'Technical indicator text.',
};

const scenarioDetails = {
  id: 'SSP / 2?',
  label: 'SSP / 2?',
  instance: 'provide internal/blue',
  yearStart: 2020,
  yearStep: 10,
  yearEnd: 2040,
  gmt: {
    data: [
      [1.1, 1.2, 1.3],
      [null, null, null],
      [1.4, null, 1.6],
    ],
    yearStart: 2020,
    yearStep: 10,
    yearEnd: 2040,
    model: 'FaIR',
    unit: '°C',
  },
  characteristics: {
    gmtPeak: [1.7, 2050],
    gmt2100: 1.5,
  },
};

describe('catalog technical clients', () => {
  test('loads indicator details from the internal API with encoded source identity', async () => {
    server.use(
      http.get('https://catalog-api.example/api/indicator-details/:id', ({ params, request }) => {
        const url = new URL(request.url);
        expect(params.id).toBe(indicatorDetails.id);
        expect(url.pathname).toBe('/api/indicator-details/Heat%20%2F%20wet%20days%3F');
        expect(url.search).toBe('?instance=provide%20internal%2Fblue');
        return HttpResponse.json(indicatorDetails);
      })
    );
    const { loadIndicatorTechnicalDetails } = await import('./catalog-api.js');

    const result = await loadIndicatorTechnicalDetails(fetch, {
      id: indicatorDetails.id,
      instance: indicatorDetails.instance,
    });

    expect(result).toEqual(indicatorDetails);
  });

  test('keeps nullable GMT cells in scenario details', async () => {
    server.use(
      http.get('https://catalog-api.example/api/scenario-details/:id', ({ params, request }) => {
        const url = new URL(request.url);
        expect(params.id).toBe(scenarioDetails.id);
        expect(url.pathname).toBe('/api/scenario-details/SSP%20%2F%202%3F');
        expect(url.search).toBe('?instance=provide%20internal%2Fblue');
        return HttpResponse.json(scenarioDetails);
      })
    );
    const { loadScenarioTechnicalDetails } = await import('./catalog-api.js');

    const result = await loadScenarioTechnicalDetails(fetch, {
      id: scenarioDetails.id,
      instance: scenarioDetails.instance,
    });

    expect(result).toEqual(scenarioDetails);
    expect(result.gmt.data).toEqual([
      [1.1, 1.2, 1.3],
      [null, null, null],
      [1.4, null, 1.6],
    ]);
  });

  test('throws an owned error with the technical response status', async () => {
    server.use(http.get('https://catalog-api.example/api/indicator-details/:id', () => HttpResponse.json({ error: 'private source detail' }, { status: 404 })));
    const { CatalogApiError, loadIndicatorTechnicalDetails } = await import('./catalog-api.js');

    const promise = loadIndicatorTechnicalDetails(fetch, {
      id: 'Missing',
      instance: 'provide-internal',
    });

    await expect(promise).rejects.toMatchObject({
      name: 'CatalogApiError',
      message: 'Catalog API request failed',
      status: 404,
    });
    await expect(promise).rejects.toBeInstanceOf(CatalogApiError);
    await expect(promise).rejects.not.toHaveProperty('message', expect.stringContaining('private source detail'));
  });

  test('turns a network failure into a safe owned gateway error', async () => {
    server.use(http.get('https://catalog-api.example/api/scenario-details/:id', () => HttpResponse.error()));
    const { CatalogApiError, loadScenarioTechnicalDetails } = await import('./catalog-api.js');

    const promise = loadScenarioTechnicalDetails(fetch, {
      id: 'Broken',
      instance: 'provide-internal',
    });

    await expect(promise).rejects.toEqual(new CatalogApiError(502));
    expect(errorLog).toHaveBeenCalledWith('Catalog technical request failed', {
      resource: 'scenario-details',
      instance: 'provide-internal',
      errorType: 'TypeError',
    });
  });

  test('reports invalid technical JSON without exposing its contents', async () => {
    server.use(http.get('https://catalog-api.example/api/indicator-details/:id', () => new HttpResponse('{"private":"source detail"', { headers: { 'Content-Type': 'application/json' } })));
    const { CatalogApiError, loadIndicatorTechnicalDetails } = await import('./catalog-api.js');

    const promise = loadIndicatorTechnicalDetails(fetch, {
      id: 'Broken',
      instance: 'provide-internal',
    });

    await expect(promise).rejects.toEqual(new CatalogApiError(502));
    expect(errorLog).toHaveBeenCalledWith('Catalog technical request failed', {
      resource: 'indicator-details',
      instance: 'provide-internal',
      errorType: 'SyntaxError',
    });
  });

  test('turns missing API configuration into an owned error before fetching', async () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('VITE_API_URL_INTERNAL', '');
    vi.stubEnv('VITE_DATA_API_URL', '');
    const request = vi.fn();
    const { CatalogApiError, loadIndicatorTechnicalDetails } = await import('./catalog-api.js');

    const promise = loadIndicatorTechnicalDetails(request, {
      id: 'Heat',
      instance: 'provide-internal',
    });

    await expect(promise).rejects.toEqual(new CatalogApiError(502));
    expect(request).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith('Catalog technical request failed', {
      resource: 'indicator-details',
      instance: 'provide-internal',
      errorType: 'TypeError',
    });
  });
});
