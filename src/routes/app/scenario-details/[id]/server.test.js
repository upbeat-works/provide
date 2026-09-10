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
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

afterAll(() => server.close());

async function getScenarioDetails(id, instance) {
  const { GET } = await import('./+server.js');
  const url = new URL(`http://localhost/app/scenario-details/selected?instance=${encodeURIComponent(instance)}`);
  return GET({ fetch, params: { id }, url });
}

describe('GET /app/scenario-details/:id', () => {
  test('returns encoded source details, nullable GMT cells, and only the Strapi description', async () => {
    server.use(
      http.get('https://catalog-api.example/api/scenario-details/:id', ({ params, request }) => {
        const url = new URL(request.url);
        expect(params.id).toBe('SSP / 2?');
        expect(url.pathname).toBe('/api/scenario-details/SSP%20%2F%202%3F');
        expect(url.search).toBe('?instance=provide%20internal%2Fblue');
        return HttpResponse.json({
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
          characteristics: { gmtPeak: [1.7, 2050], gmt2100: 1.5 },
        });
      }),
      http.get('https://catalog-cms.example/api/scenarios', () =>
        HttpResponse.json({
          data: [
            {
              id: 9,
              attributes: {
                UID: 'SSP / 2?',
                Description: 'Editorial scenario text.',
                ScenarioCharacteristics: [{ Year: 2050, Description: 'private timeline text' }],
              },
            },
          ],
          meta: { pagination: { page: 1, pageSize: 1, pageCount: 1, total: 1 } },
        })
      )
    );

    const response = await getScenarioDetails('SSP / 2?', 'provide internal/blue');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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
      characteristics: { gmtPeak: [1.7, 2050], gmt2100: 1.5 },
      description: 'Editorial scenario text.',
    });
  });

  test('returns technical data without a description when Strapi fails', async () => {
    server.use(
      http.get('https://catalog-api.example/api/scenario-details/:id', () =>
        HttpResponse.json({
          id: 'SSP2',
          label: 'SSP2',
          instance: 'provide',
          yearStart: 2020,
          yearStep: 10,
          yearEnd: 2040,
          characteristics: {},
        })
      ),
      http.get('https://catalog-cms.example/api/scenarios', () => HttpResponse.error())
    );

    const response = await getScenarioDetails('SSP2', 'provide');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'SSP2',
      label: 'SSP2',
      instance: 'provide',
      yearStart: 2020,
      yearStep: 10,
      yearEnd: 2040,
      characteristics: {},
    });
  });

  test('returns the technical error status without exposing its body', async () => {
    server.use(
      http.get('https://catalog-api.example/api/scenario-details/:id', () => HttpResponse.json({ error: 'private IXMP4 detail' }, { status: 502 })),
      http.get('https://catalog-cms.example/api/scenarios', () => HttpResponse.json({ data: [], meta: {} }))
    );

    const response = await getScenarioDetails('Broken', 'provide');

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'Catalog API request failed' });
  });
});
