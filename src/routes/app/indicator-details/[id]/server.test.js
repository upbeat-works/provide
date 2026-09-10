import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  vi.stubEnv('SSR', true);
  vi.stubEnv('VITE_API_URL', 'https://public-api.example/api');
  vi.stubEnv('VITE_API_URL_INTERNAL', 'https://catalog-api.example/api');
  vi.stubEnv('VITE_CMS_URL', 'https://public-cms.example');
  vi.stubEnv('VITE_CMS_URL_INTERNAL', 'https://catalog-cms.example');
  vi.stubEnv('VITE_STRAPI_LOCALE', 'en');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

afterAll(() => server.close());

async function getIndicatorDetails(id, instance) {
  const { GET } = await import('./+server.js');
  const url = new URL(`http://localhost/app/indicator-details/selected?instance=${encodeURIComponent(instance)}`);
  return GET({ fetch, params: { id }, url });
}

describe('GET /app/indicator-details/:id', () => {
  test.each([
    ['indicator', () => import('./+server.js')],
    ['scenario', () => import('../../scenario-details/[id]/+server.js')],
  ])('returns 400 without a network request when the %s instance is missing', async (resource, loadEndpoint) => {
    const endpointFetch = vi.fn(() => Promise.reject(new Error('unexpected network request')));
    const { GET } = await loadEndpoint();
    const url = new URL(`http://localhost/app/${resource}-details/Selected`);

    const response = await GET({ fetch: endpointFetch, params: { id: 'Selected' }, url });

    expect(endpointFetch).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Missing required query parameter: instance' });
  });

  test.each([
    [
      'indicator',
      () => import('./+server.js'),
      {
        id: 'Heat',
        instance: 'provide',
        unit: 'days',
        parameters: [],
        models: [],
        sources: [],
        ixmp4Description: 'Technical fallback.',
      },
      {
        id: 'Heat',
        instance: 'provide',
        unit: 'days',
        parameters: [],
        models: [],
        sources: [],
        ixmp4Description: 'Technical fallback.',
        description: 'Technical fallback.',
      },
    ],
    [
      'scenario',
      () => import('../../scenario-details/[id]/+server.js'),
      {
        id: 'SSP2',
        label: 'SSP2',
        instance: 'provide',
        yearStart: 2020,
        yearStep: 10,
        yearEnd: 2040,
        characteristics: {},
      },
      {
        id: 'SSP2',
        label: 'SSP2',
        instance: 'provide',
        yearStart: 2020,
        yearStep: 10,
        yearEnd: 2040,
        characteristics: {},
      },
    ],
  ])('returns %s technical data when Strapi does not settle', async (resource, loadEndpoint, technicalDetails, expectedDetails) => {
    vi.useFakeTimers();
    let contentSignal;
    const endpointFetch = vi.fn((request, options) => {
      if (String(request).includes('catalog-cms.example')) {
        contentSignal = options?.signal;
        return new Promise((resolve, reject) => {
          contentSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
      }
      return Promise.resolve(HttpResponse.json(technicalDetails));
    });
    const { GET } = await loadEndpoint();
    const url = new URL(`http://localhost/app/${resource}-details/Selected?instance=provide`);
    let response;

    void GET({ fetch: endpointFetch, params: { id: technicalDetails.id }, url }).then((value) => {
      response = value;
    });
    await vi.advanceTimersByTimeAsync(1000);

    expect(contentSignal?.aborted).toBe(true);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expectedDetails);
  });

  test.each([
    ['indicator', () => import('./+server.js')],
    ['scenario', () => import('../../scenario-details/[id]/+server.js')],
  ])('does not abort a completed %s Strapi request after the limit', async (resource, loadEndpoint) => {
    vi.useFakeTimers();
    let contentSignal;
    const endpointFetch = vi.fn((request, options) => {
      if (String(request).includes('catalog-cms.example')) {
        contentSignal = options?.signal;
        return Promise.resolve(
          HttpResponse.json({
            data: [{ id: 1, attributes: { UID: 'Selected', Description: 'Editorial text.' } }],
            meta: { pagination: { page: 1, pageSize: 1, pageCount: 1, total: 1 } },
          })
        );
      }
      return Promise.resolve(HttpResponse.json({ id: 'Selected', instance: 'provide' }));
    });
    const { GET } = await loadEndpoint();
    const url = new URL(`http://localhost/app/${resource}-details/Selected?instance=provide`);

    const response = await GET({ fetch: endpointFetch, params: { id: 'Selected' }, url });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ description: 'Editorial text.' });
    expect(contentSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(contentSignal?.aborted).toBe(false);
  });

  test.each([
    ['indicator', () => import('./+server.js')],
    ['scenario', () => import('../../scenario-details/[id]/+server.js')],
  ])('cancels the %s Strapi request before returning a technical failure', async (resource, loadEndpoint) => {
    vi.useFakeTimers();
    let contentSignal;
    let contentRequestAlive = true;
    const endpointFetch = vi.fn((request, options) => {
      if (String(request).includes('catalog-cms.example')) {
        contentSignal = options?.signal;
        return new Promise((resolve, reject) => {
          contentSignal?.addEventListener(
            'abort',
            () => {
              contentRequestAlive = false;
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true }
          );
        });
      }
      return Promise.resolve(HttpResponse.json({ error: 'private detail' }, { status: 502 }));
    });
    const { GET } = await loadEndpoint();
    const url = new URL(`http://localhost/app/${resource}-details/Selected?instance=provide`);

    const response = await GET({ fetch: endpointFetch, params: { id: 'Selected' }, url });

    expect(response.status).toBe(502);
    expect(contentSignal?.aborted).toBe(true);
    expect(contentRequestAlive).toBe(false);
  });

  test('returns technical details with only the Strapi description added', async () => {
    server.use(
      http.get('https://catalog-api.example/api/indicator-details/:id', ({ params, request }) => {
        const url = new URL(request.url);
        expect(params.id).toBe('Heat / wet days?');
        expect(url.pathname).toBe('/api/indicator-details/Heat%20%2F%20wet%20days%3F');
        expect(url.search).toBe('?instance=provide%20internal%2Fblue');
        return HttpResponse.json({
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
        });
      }),
      http.get('https://catalog-cms.example/api/indicators', () =>
        HttpResponse.json({
          data: [
            {
              id: 8,
              attributes: {
                UID: 'Heat / wet days?',
                Description: 'Editorial indicator text.',
                PrivateNotes: 'must stay private',
              },
            },
          ],
          meta: { pagination: { page: 1, pageSize: 1, pageCount: 1, total: 1 } },
        })
      )
    );

    const response = await getIndicatorDetails('Heat / wet days?', 'provide internal/blue');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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
      description: 'Editorial indicator text.',
    });
  });

  test('uses IXMP4 text and returns technical data when Strapi fails', async () => {
    server.use(
      http.get('https://catalog-api.example/api/indicator-details/:id', () =>
        HttpResponse.json({
          id: 'Heat',
          instance: 'provide',
          unit: 'days',
          parameters: [],
          models: [],
          sources: [],
          ixmp4Description: 'Technical fallback.',
        })
      ),
      http.get('https://catalog-cms.example/api/indicators', () => HttpResponse.json({ error: 'unavailable' }, { status: 503 }))
    );

    const response = await getIndicatorDetails('Heat', 'provide');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'Heat',
      instance: 'provide',
      unit: 'days',
      parameters: [],
      models: [],
      sources: [],
      ixmp4Description: 'Technical fallback.',
      description: 'Technical fallback.',
    });
  });

  test('returns the technical error status without exposing its body', async () => {
    server.use(
      http.get('https://catalog-api.example/api/indicator-details/:id', () => HttpResponse.json({ error: 'private IXMP4 detail' }, { status: 404 })),
      http.get('https://catalog-cms.example/api/indicators', () => HttpResponse.json({ data: [], meta: {} }))
    );

    const response = await getIndicatorDetails('Missing', 'provide');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Catalog API request failed' });
  });
});
