import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  vi.stubEnv('SSR', true);
  vi.stubEnv('VITE_CMS_URL', 'https://public-cms.example');
  vi.stubEnv('VITE_CMS_URL_INTERNAL', 'https://catalog-cms.example');
  vi.stubEnv('VITE_STRAPI_LOCALE', 'en');
});

afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
  vi.resetModules();
});

afterAll(() => server.close());

describe('catalog editorial clients', () => {
  test.each([
    ['indicator', 'indicators', 'Heat / wet?', 'Indicator text.', 'loadIndicatorDescription'],
    ['scenario', 'scenarios', 'SSP / 2?', 'Scenario text.', 'loadScenarioDescription'],
  ])('loads one %s description using its encoded Strapi UID', async (_, collection, id, description, exportName) => {
    server.use(
      http.get(`https://catalog-cms.example/api/${collection}`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('fields[0]')).toBe('UID');
        expect(url.searchParams.get('fields[1]')).toBe('Description');
        expect(url.searchParams.get('locale')).toBe('en');
        expect(url.searchParams.get('pagination[limit]')).toBe('1');
        expect(url.searchParams.get('filters[UID][$eq]')).toBe(id);
        expect(url.search).toContain(`filters[UID][$eq]=${encodeURIComponent(id)}`);
        return HttpResponse.json({
          data: [
            {
              id: 8,
              attributes: {
                UID: id,
                Description: description,
              },
            },
          ],
          meta: {
            pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 },
          },
        });
      })
    );
    const catalogContent = await import('./catalog-content.js');

    const result = await catalogContent[exportName](fetch, { id });

    expect(result).toBe(description);
  });

  test.each([
    ['indicator', 'loadIndicatorDescription'],
    ['scenario', 'loadScenarioDescription'],
  ])('forwards an abort signal for the optional %s request', async (_, exportName) => {
    const controller = new AbortController();
    let receivedSignal;
    const request = (_url, options) => {
      receivedSignal = options?.signal;
      return new Promise((_, reject) => {
        receivedSignal.addEventListener(
          'abort',
          () => {
            const error = new Error('Request aborted');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true }
        );
      });
    };
    const catalogContent = await import('./catalog-content.js');

    const result = catalogContent[exportName](request, {
      id: 'Heat',
      signal: controller.signal,
    });

    expect(receivedSignal).toBe(controller.signal);
    controller.abort();
    await expect(result).resolves.toBeUndefined();
  });

  test.each([
    ['missing indicator', 'indicators', 'loadIndicatorDescription', HttpResponse.json({ data: [], meta: {} })],
    [
      'failed scenario',
      'scenarios',
      'loadScenarioDescription',
      HttpResponse.json(
        {
          data: [
            {
              id: 8,
              attributes: { UID: 'Missing', Description: 'private source detail' },
            },
          ],
        },
        { status: 503 }
      ),
    ],
  ])('returns undefined for %s optional text', async (_, collection, exportName, response) => {
    server.use(http.get(`https://catalog-cms.example/api/${collection}`, () => response));
    const catalogContent = await import('./catalog-content.js');

    const result = await catalogContent[exportName](fetch, { id: 'Missing' });

    expect(result).toBeUndefined();
  });
});
