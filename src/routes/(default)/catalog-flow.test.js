import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createRuntimeCatalog } from '$stores/runtime-catalog.js';
import { createCatalogFlow, selectionUrlParams } from '$stores/catalog-flow.js';
import {
  geographyControlView,
  geographyListRequest,
  percentileChartView,
  retryPercentileChartRequest,
  retryWarmingChartRequest,
  warmingChartView,
} from '$stores/catalog-adapters.js';

const API_URL = 'https://catalog.example/api';
const APP_URL = 'https://provide.example/app';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
  vi.resetModules();
});
afterAll(() => server.close());

function indicator(id = 'Heat', instance = 'provide-external') {
  return { id, label: `${id} label`, unit: 'days', instance };
}

function indicatorDetails(id = 'Heat', instance = 'provide-external') {
  return {
    id,
    instance,
    unit: 'days',
    parameters: [
      {
        id: 'time',
        label: 'Time',
        options: [
          { id: 'Annual', label: 'Annual' },
          { id: 'Seasonal', label: 'Seasonal' },
        ],
      },
    ],
    models: ['model'],
    sources: ['source'],
    description: 'Useful detail',
  };
}

function createFlow(options = {}) {
  const catalog = createRuntimeCatalog({
    fetch,
    apiUrl: API_URL,
    appUrl: APP_URL,
    defaultScenarios: ['Low'],
    ...options,
  });
  return { catalog, flow: createCatalogFlow(catalog) };
}

test('scenario choices enforce availability, timeframe, and the selection limit', () => {
  const { catalog, flow } = createFlow();
  const scenarios = [
    { uid: 'Old', endYear: 2050 },
    { uid: 'A', endYear: 2100 },
    { uid: 'B', endYear: 2100 },
    { uid: 'C', endYear: 2100 },
    { uid: 'D', endYear: 2100, disabled: true },
    { uid: 'E', endYear: 2100 },
  ];

  catalog.selectScenarios(['Unavailable', 'D']);
  flow.toggleScenario('A', { scenarios, timeframe: 2100 });
  flow.toggleScenario('B', { scenarios, timeframe: 2100 });
  flow.toggleScenario('C', { scenarios, timeframe: 2100 });
  flow.toggleScenario('E', { scenarios, timeframe: 2100 });
  expect(get(catalog.selection).scenarios).toEqual(['A', 'B', 'C']);

  flow.toggleScenario('D', { scenarios, timeframe: 2100 });
  expect(get(catalog.selection).scenarios).toEqual(['A', 'B', 'C']);

  flow.toggleScenario('Old', { scenarios, timeframe: 2050 });
  expect(get(catalog.selection).scenarios).toEqual(['Old']);
});

function useIndexHandlers(requests = []) {
  server.use(
    http.get(`${API_URL}/indicators`, ({ request }) => {
      const url = new URL(request.url);
      requests.push(`${url.pathname}${url.search}`);
      if (url.searchParams.has('Sector')) {
        return HttpResponse.json({
          indicators: [indicator()],
          failedInstances: [],
          filters: [
            {
              key: 'Sector',
              label: 'Sector',
              color: '#123456',
              options: [{ value: 'Health', count: 1 }],
              selected: [],
            },
          ],
        });
      }
      return HttpResponse.json({ indicators: [indicator()], failedInstances: [] });
    }),
    http.get(`${API_URL}/geographies`, () => HttpResponse.json([{ id: 'DEU', label: 'Germany', geographyType: 'admin0', parents: ['Europe'] }])),
    http.get(`${API_URL}/geographies/types`, () => HttpResponse.json([{ id: 'admin0', label: 'Countries', isSelectable: true }]))
  );
}

function useSelectionHandlers(requests) {
  server.use(
    http.get(`${API_URL}/indicators`, ({ request }) => {
      const url = new URL(request.url);
      requests.push(`${url.pathname}${url.search}`);
      return HttpResponse.json({ indicators: [indicator()], failedInstances: [], filters: [] });
    }),
    http.get(`${API_URL}/geography-availability`, ({ request }) => {
      requests.push(new URL(request.url).search);
      return HttpResponse.json({ geographyIds: ['DEU'] });
    }),
    http.get(`${APP_URL}/indicator-details/Heat`, ({ request }) => {
      requests.push(new URL(request.url).search);
      return HttpResponse.json(indicatorDetails());
    }),
    http.get(`${API_URL}/scenario-availability`, ({ request }) => {
      const url = new URL(request.url);
      requests.push(url.search);
      const axis = url.searchParams.get('axis');
      return HttpResponse.json({
        scenarios: [{ id: axis === 'warmingLevel' ? 'High' : 'Low', label: axis === 'warmingLevel' ? 'High' : 'Low', yearStart: 2020, yearEnd: 2100 }],
      });
    }),
    http.get(`${APP_URL}/scenario-details/Low`, ({ request }) => {
      requests.push(new URL(request.url).search);
      return HttpResponse.json({
        id: 'Low',
        label: 'Low',
        instance: 'provide-external',
        yearStart: 2020,
        yearStep: 5,
        yearEnd: 2100,
        characteristics: {},
      });
    })
  );
}

describe('catalog page flow', () => {
  test('keeps the indicator when a removed filter finishes, and checks that filter again when reapplied', async () => {
    let finish;
    const catalog = createRuntimeCatalog({
      fetch: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const flow = createCatalogFlow(catalog);
    catalog.selectIndicator(indicator());
    const context = { mode: 'indicator' };
    const filters = { Sector: ['Water'] };

    const loading = flow.applyFilters(filters, context);
    await flow.applyFilters({}, context);
    finish(Response.json({ indicators: [], failedInstances: [] }));
    await loading;

    expect(get(catalog.selection).indicator).toEqual({ id: 'Heat', instance: 'provide-external' });

    const reapplied = flow.applyFilters(filters, context);
    finish(Response.json({ indicators: [], failedInstances: [] }));
    await reapplied;
    expect(get(catalog.selection).indicator).toBeUndefined();
  });

  test('retries details with valid parameter defaults and reloads chart availability', async () => {
    const requests = [];
    useSelectionHandlers(requests);
    const { catalog, flow } = createFlow();
    let failed = true;
    server.use(
      http.get(`${APP_URL}/indicator-details/Heat`, () => {
        if (failed) return HttpResponse.json({}, { status: 503 });
        return HttpResponse.json(indicatorDetails());
      })
    );
    catalog.setPendingSelection({
      indicator: 'Heat',
      instance: 'provide-external',
      geography: 'DEU',
      parameters: { time: 'Unavailable' },
      scenarios: ['Low'],
    });
    await flow.chooseIndicator(indicator());
    expect(get(catalog.indicatorDetails).status).toBe('failure');

    failed = false;
    await flow.retryIndicatorDetails();

    expect(get(catalog.selection).parameters).toEqual({ time: 'Annual' });
    for (const availability of [catalog.percentileAvailability, catalog.warmingLevelAvailability]) {
      expect(get(availability)).toMatchObject({
        status: 'success',
        data: { context: { parameters: { time: 'Annual' } } },
      });
    }
    expect(requests.some((request) => request.includes('time=Annual') && request.includes('axis=percentile'))).toBe(true);
    expect(requests.some((request) => request.includes('time=Annual') && request.includes('axis=warmingLevel'))).toBe(true);
  });

  test('landing and Explore server loads request editorial data without a catalog scan', async () => {
    vi.stubEnv('SSR', true);
    vi.stubEnv('VITE_API_URL', API_URL);
    vi.stubEnv('VITE_CMS_URL', 'https://cms.example');
    vi.stubEnv('VITE_STRAPI_LOCALE', 'en');
    const requests = [];
    const loaderFetch = async (request) => {
      const url = new URL(String(request));
      requests.push(`${url.host}${url.pathname}`);
      if (url.pathname.includes('landing-project')) return HttpResponse.json({ data: null });
      if (url.pathname.includes('case-study-dynamics')) return HttpResponse.json({ data: [] });
      if (url.pathname.includes('/geographies/types')) return HttpResponse.json([]);
      if (url.pathname.includes('/geographies/')) return HttpResponse.json([]);
      if (url.pathname.endsWith('/catalog/')) {
        return HttpResponse.json({ indicatorParameters: [], facets: [], indicators: [], scenarios: [] });
      }
      if (url.pathname.endsWith('/indicators') || url.pathname.endsWith('/scenarios')) {
        return HttpResponse.json({ data: [] });
      }
      return HttpResponse.json({ error: 'Unexpected request' }, { status: 500 });
    };
    const [{ load: loadLanding }, { load: loadImpacts }, { load: loadExplore }] = await Promise.all([
      import('./+page.server.js'),
      import('./impacts/+layout.server.js'),
      import('./impacts/explore/+page.server.js'),
    ]);

    const landing = await loadLanding({ fetch: loaderFetch });
    const impacts = await loadImpacts({ fetch: loaderFetch });
    const explore = await loadExplore({ fetch: loaderFetch });

    expect(landing.catalog).toBeUndefined();
    expect(landing.geographies).toBeUndefined();
    expect(impacts.geographies).toBeUndefined();
    expect(explore.catalog).toBeUndefined();
    expect(requests.filter((request) => request.includes('/api/catalog'))).toEqual([]);
    expect(requests.filter((request) => request.includes('/api/geographies'))).toEqual([]);
  });

  test('starts each landing index independently and keeps geography usable when the indicator index fails', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.has('Sector')) {
          return HttpResponse.json({ indicators: [], failedInstances: [], filters: [] });
        }
        return HttpResponse.json({ error: 'Indicator sources unavailable' }, { status: 503 });
      }),
      http.get(`${API_URL}/geographies`, () => HttpResponse.json([{ id: 'DEU', label: 'Germany', geographyType: 'admin0', parents: [] }])),
      http.get(`${API_URL}/geographies/types`, () => HttpResponse.json([{ id: 'admin0', label: 'Countries', isSelectable: true }]))
    );
    const { catalog, flow } = createFlow();

    await flow.start();

    expect(get(catalog.indicatorIndex)).toEqual({ status: 'failure', error: 'Indicator sources unavailable' });
    expect(get(catalog.filterGroups).status).toBe('success');
    expect(get(catalog.geographyIndex)).toMatchObject({
      status: 'success',
      data: { geographies: [{ id: 'DEU' }] },
    });
  });

  test('supports geography-first and sends the indicator instance on every dependent request', async () => {
    const requests = [];
    useSelectionHandlers(requests);
    const { catalog, flow } = createFlow();

    await flow.chooseGeography('DEU');
    await flow.chooseIndicator(indicator());
    await flow.loadScenarioDetails('Low');

    expect(get(catalog.selection)).toEqual({
      indicator: { id: 'Heat', instance: 'provide-external' },
      geography: 'DEU',
      parameters: { time: 'Annual' },
      scenarios: ['Low'],
    });
    expect(get(catalog.indicatorDetails)).toMatchObject({ status: 'success', data: { description: 'Useful detail' } });
    expect(get(catalog.percentileAvailability)).toMatchObject({ status: 'success', data: { scenarios: [{ id: 'Low' }] } });
    expect(get(catalog.warmingLevelAvailability)).toMatchObject({ status: 'success', data: { scenarios: [{ id: 'High' }] } });
    expect(requests.filter((request) => request.includes('instance=provide-external'))).toHaveLength(5);
    expect(requests.some((request) => request.includes('axis=percentile'))).toBe(true);
    expect(requests.some((request) => request.includes('axis=warmingLevel'))).toBe(true);
  });

  test('supports indicator-first, reloads both availability axes after a parameter change, and keeps them separate', async () => {
    const requests = [];
    useSelectionHandlers(requests);
    const { catalog, flow } = createFlow();

    await flow.chooseIndicator(indicator());
    expect(get(catalog.selection).geography).toBeUndefined();
    await flow.chooseGeography('DEU');
    await flow.changeParameters({ time: 'Seasonal' });

    expect(get(catalog.selection).parameters).toEqual({ time: 'Seasonal' });
    expect(get(catalog.percentileAvailability).data.scenarios[0].id).toBe('Low');
    expect(get(catalog.warmingLevelAvailability).data.scenarios[0].id).toBe('High');
    const seasonalRequests = requests.filter((request) => request.includes('time=Seasonal'));
    expect(seasonalRequests).toHaveLength(2);
    expect(seasonalRequests.every((request) => request.includes('instance=provide-external'))).toBe(true);
  });

  test('loads the first advanced filter, applies it, and retries a failed detail without losing the pair', async () => {
    const requests = [];
    let detailAttempt = 0;
    useIndexHandlers(requests);
    server.use(
      http.get(`${APP_URL}/indicator-details/Heat`, ({ request }) => {
        detailAttempt += 1;
        requests.push(new URL(request.url).search);
        if (detailAttempt === 1) return HttpResponse.json({ error: 'Temporary failure' }, { status: 502 });
        return HttpResponse.json(indicatorDetails());
      }),
      http.get(`${API_URL}/geography-availability`, () => HttpResponse.json({ geographyIds: ['DEU'] })),
      http.get(`${API_URL}/scenario-availability`, () => HttpResponse.json({ scenarios: [] }))
    );
    const { catalog, flow } = createFlow();

    await flow.openAdvancedFilters();
    await flow.applyFilters({ Sector: ['Health'] });
    await flow.chooseIndicator(indicator());
    expect(get(catalog.indicatorDetails).status).toBe('failure');
    await flow.retryIndicatorDetails();

    expect(get(catalog.filterGroups)).toMatchObject({ status: 'success', data: { filters: [{ key: 'Sector' }] } });
    expect(get(catalog.indicatorFilters)).toEqual({ Sector: ['Health'] });
    expect(requests.some((request) => request.includes('Sector=Health'))).toBe(true);
    expect(get(catalog.indicatorDetails).status).toBe('success');
    expect(get(catalog.selection).indicator).toEqual({ id: 'Heat', instance: 'provide-external' });
  });

  test('deduplicates matching reactive indicator scopes and reloads when mode or geography changes', async () => {
    const requests = [];
    useIndexHandlers(requests);
    const { flow } = createFlow();
    const filters = { Sector: ['Health'] };

    await flow.applyFilters(filters, { mode: 'geography', geography: 'DEU' });
    await flow.syncIndicatorScope({ mode: 'geography', geography: 'DEU', filters });
    await flow.syncIndicatorScope({ mode: 'geography', geography: 'FRA', filters });
    await flow.syncIndicatorScope({ mode: 'indicator', geography: 'FRA', filters });

    expect(requests).toEqual(['/api/indicators?region=DEU&Sector=Health', '/api/indicators?region=FRA&Sector=Health', '/api/indicators?Sector=Health']);
  });

  test('does not request an unfiltered indicator list for an empty initial geography', async () => {
    const requests = [];
    useIndexHandlers(requests);
    const { flow } = createFlow();

    await flow.chooseGeography(undefined);
    await flow.syncIndicatorScope({ mode: 'geography', geography: undefined, filters: {} });

    expect(requests).toEqual([]);
  });

  test('keeps a URL geography pending until a slow index replaces it with the first country', async () => {
    server.use(
      http.get(`${API_URL}/geographies`, async () => {
        await delay(30);
        return HttpResponse.json([{ id: 'ESP', label: 'Spain', geographyType: 'admin0', parents: [] }]);
      }),
      http.get(`${API_URL}/geographies/types`, () => HttpResponse.json([{ id: 'admin0', label: 'Countries', isSelectable: true }]))
    );
    const { catalog } = createFlow();
    catalog.setPendingSelection({ geography: 'DEU' });

    const load = catalog.loadGeographyIndex();
    const loadingView = geographyControlView({
      selection: get(catalog.selection),
      pendingSelection: get(catalog.pendingSelection),
      request: get(catalog.geographyIndex),
      items: [],
    });

    expect(loadingView).toMatchObject({ selectedId: 'DEU', pending: true, list: { status: 'loading' } });

    await load;
    const request = get(catalog.geographyIndex);
    const settledView = geographyControlView({
      selection: get(catalog.selection),
      pendingSelection: get(catalog.pendingSelection),
      request,
      items: request.data.geographies,
    });

    expect(settledView).toMatchObject({ selectedId: 'ESP', pending: false, list: { status: 'ready' } });
  });

  test('keeps an indicator-first URL geography pending until availability rejects it', async () => {
    useIndexHandlers();
    server.use(
      http.get(`${API_URL}/geography-availability`, async () => {
        await delay(30);
        return HttpResponse.json({ geographyIds: ['ESP'] });
      })
    );
    const { catalog, flow } = createFlow();
    catalog.setPendingSelection({ indicator: 'Heat', instance: 'provide-external', geography: 'DEU' });

    await flow.start();
    const load = catalog.loadGeographyAvailability();
    const request = geographyListRequest({
      mode: 'indicator',
      selection: get(catalog.selection),
      indexRequest: get(catalog.geographyIndex),
      availabilityRequest: get(catalog.geographyAvailability),
    });
    const loadingView = geographyControlView({
      selection: get(catalog.selection),
      pendingSelection: get(catalog.pendingSelection),
      request,
      items: [],
    });

    expect(loadingView).toMatchObject({ selectedId: 'DEU', pending: true, list: { status: 'loading' } });

    await load;
    expect(get(catalog.selection).geography).toBeUndefined();
    expect(get(catalog.pendingSelection).geography).toBeUndefined();
  });

  test('retries failed percentile availability from the scenario control', async () => {
    let attempts = 0;
    server.use(
      http.get(`${API_URL}/scenario-availability`, () => {
        attempts += 1;
        if (attempts === 1) return HttpResponse.json({ error: 'Temporary failure' }, { status: 502 });
        return HttpResponse.json({ scenarios: [{ id: 'Low', label: 'Low' }] });
      })
    );
    const { catalog, flow } = createFlow();
    catalog.selectIndicator(indicator());
    catalog.selectGeography('DEU');

    await flow.retryPercentileAvailability();
    expect(get(catalog.percentileAvailability).status).toBe('failure');

    await flow.retryPercentileAvailability();
    expect(get(catalog.percentileAvailability)).toMatchObject({ status: 'success', data: { scenarios: [{ id: 'Low' }] } });
    expect(attempts).toBe(2);
  });

  test('keeps both chart axes gated until a failed filtered scope and each availability request recover', async () => {
    let scopeAttempts = 0;
    server.use(
      http.get(`${API_URL}/indicators`, ({ request }) => {
        const url = new URL(request.url);
        if (!url.searchParams.has('Sector')) return HttpResponse.json({ indicators: [indicator()], failedInstances: [] });
        scopeAttempts += 1;
        if (scopeAttempts === 1) return HttpResponse.json({ error: 'Filter source failed' }, { status: 503 });
        return HttpResponse.json({ indicators: [indicator()], failedInstances: [], filters: [] });
      }),
      http.get(`${API_URL}/scenario-availability`, ({ request }) => {
        const axis = new URL(request.url).searchParams.get('axis');
        return HttpResponse.json({ scenarios: [{ id: axis === 'warmingLevel' ? 'High' : 'Low' }] });
      })
    );
    const { catalog, flow } = createFlow();
    const context = { mode: 'geography', geography: 'DEU', filters: { Sector: ['Health'] } };
    catalog.selectIndicator(indicator());
    catalog.selectGeography('DEU');

    await flow.applyFilters(context.filters, context);
    const selection = get(catalog.selection);
    const failedScope = get(catalog.filteredIndicators);
    const failedPercentileView = percentileChartView({
      combinationAvailable: true,
      availability: get(catalog.percentileAvailability),
      indicatorScopeRequest: failedScope,
      indicatorScopeContext: context,
      selection,
    });
    const failedWarmingView = warmingChartView({
      combinationAvailable: true,
      availability: get(catalog.warmingLevelAvailability),
      indicatorScopeRequest: failedScope,
      indicatorScopeContext: context,
      selection,
    });

    expect(failedPercentileView).toEqual({ status: 'failure', failedRequest: 'indicatorScope' });
    expect(failedWarmingView).toEqual({ status: 'failure', failedRequest: 'indicatorScope' });

    await flow.retryIndicatorScope(context);
    const recoveredScope = get(catalog.filteredIndicators);
    const waitingPercentileView = percentileChartView({
      combinationAvailable: true,
      availability: get(catalog.percentileAvailability),
      indicatorScopeRequest: recoveredScope,
      indicatorScopeContext: context,
      selection,
    });
    expect(waitingPercentileView).toEqual({ status: 'loading' });

    await Promise.all([flow.retryPercentileAvailability(), flow.retryWarmingLevelAvailability()]);
    const percentileView = percentileChartView({
      combinationAvailable: true,
      availability: get(catalog.percentileAvailability),
      indicatorScopeRequest: recoveredScope,
      indicatorScopeContext: context,
      selection,
    });
    const warmingView = warmingChartView({
      combinationAvailable: true,
      availability: get(catalog.warmingLevelAvailability),
      indicatorScopeRequest: recoveredScope,
      indicatorScopeContext: context,
      selection,
    });

    expect(percentileView).toEqual({ status: 'ready' });
    expect(warmingView).toEqual({ status: 'ready' });
    expect(scopeAttempts).toBe(2);
  });

  test.each([
    {
      axis: 'percentile',
      retryChart: retryPercentileChartRequest,
      failAvailability: (flow) => flow.retryPercentileAvailability(),
      availabilityState: (catalog) => get(catalog.percentileAvailability),
      otherAvailabilityState: (catalog) => get(catalog.warmingLevelAvailability),
    },
    {
      axis: 'warmingLevel',
      retryChart: retryWarmingChartRequest,
      failAvailability: (flow) => flow.retryWarmingLevelAvailability(),
      availabilityState: (catalog) => get(catalog.warmingLevelAvailability),
      otherAvailabilityState: (catalog) => get(catalog.percentileAvailability),
    },
  ])('routes $axis chart retries to the failed public request', async ({ axis, retryChart, failAvailability, availabilityState, otherAvailabilityState }) => {
    let scopeAttempts = 0;
    let availabilityAttempts = 0;
    server.use(
      http.get(`${API_URL}/indicators`, ({ request }) => {
        const url = new URL(request.url);
        if (!url.searchParams.has('Sector')) return HttpResponse.json({ indicators: [indicator()], failedInstances: [] });
        scopeAttempts += 1;
        if (scopeAttempts === 1) return HttpResponse.json({ error: 'Filter source failed' }, { status: 503 });
        return HttpResponse.json({ indicators: [indicator()], failedInstances: [], filters: [] });
      }),
      http.get(`${API_URL}/scenario-availability`, ({ request }) => {
        if (new URL(request.url).searchParams.get('axis') !== axis) return HttpResponse.json({ error: 'Wrong availability axis' }, { status: 400 });
        availabilityAttempts += 1;
        if (availabilityAttempts === 1) return HttpResponse.json({ error: 'Availability failed' }, { status: 503 });
        return HttpResponse.json({ scenarios: [{ id: 'Low', label: 'Low' }] });
      })
    );
    const { catalog, flow } = createFlow();
    const indicatorScopeContext = { mode: 'geography', geography: 'DEU', filters: { Sector: ['Health'] } };
    catalog.selectIndicator(indicator());
    catalog.selectGeography('DEU');

    await flow.applyFilters(indicatorScopeContext.filters, indicatorScopeContext);
    await retryChart({ view: { status: 'failure', failedRequest: 'indicatorScope' }, flow, indicatorScopeContext });

    expect(get(catalog.filteredIndicators).status).toBe('success');
    expect(scopeAttempts).toBe(2);

    await failAvailability(flow);
    expect(availabilityState(catalog).status).toBe('failure');
    await retryChart({ view: { status: 'failure', failedRequest: 'availability' }, flow, indicatorScopeContext });

    expect(availabilityState(catalog).status).toBe('success');
    expect(otherAvailabilityState(catalog).status).toBe('idle');
    expect(availabilityAttempts).toBe(2);
  });

  test('retries failed advanced-filter loading from the filter control', async () => {
    let attempts = 0;
    server.use(
      http.get(`${API_URL}/indicators`, () => {
        attempts += 1;
        if (attempts === 1) return HttpResponse.json({ error: 'Temporary failure' }, { status: 502 });
        return HttpResponse.json({ indicators: [], failedInstances: [], filters: [] });
      })
    );
    const { catalog, flow } = createFlow();

    await flow.openAdvancedFilters();
    expect(get(catalog.filterGroups).status).toBe('failure');

    await flow.openAdvancedFilters();
    expect(get(catalog.filterGroups).status).toBe('success');
    expect(attempts).toBe(2);
  });

  test('adds the selected instance to shared and chart URL parameters', () => {
    expect(
      selectionUrlParams({
        indicator: { id: 'Heat / wet', instance: 'provide-external' },
        geography: 'DEU',
        parameters: { time: 'Annual' },
        scenarios: ['Low'],
      })
    ).toEqual({
      indicator: 'Heat / wet',
      instance: 'provide-external',
      geography: 'DEU',
      time: 'Annual',
      scenarios: ['Low'],
    });
  });
});
