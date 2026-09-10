import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { get } from 'svelte/store';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createRuntimeCatalog, reconcileConfirmedSelection } from './runtime-catalog.js';

const API_URL = 'https://catalog.example/api';
const APP_URL = 'https://provide.example/app';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createCatalog(options = {}) {
  return createRuntimeCatalog({ fetch, apiUrl: API_URL, appUrl: APP_URL, ...options });
}

function indicator(id, instance = 'provide-internal') {
  return { id, label: id, unit: 'days', instance };
}

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    values,
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };
}

describe('runtime catalog selection', () => {
  test('loads the two geography index resources into one focused state', async () => {
    server.use(
      http.get(`${API_URL}/geographies`, () => HttpResponse.json([{ id: 'DEU', label: 'Germany', geographyType: 'admin0' }])),
      http.get(`${API_URL}/geographies/types`, () => HttpResponse.json([{ id: 'admin0', label: 'Countries', isSelectable: true }]))
    );
    const catalog = createCatalog();

    await catalog.loadGeographyIndex();

    expect(get(catalog.geographyIndex)).toEqual({
      status: 'success',
      data: {
        geographies: [{ id: 'DEU', label: 'Germany', geographyType: 'admin0' }],
        geographyTypes: [{ id: 'admin0', label: 'Countries', isSelectable: true }],
      },
    });
  });

  test('loads a filtered indicator index from the active filter store', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('region') !== 'DEU' || url.searchParams.get('Data Source') !== 'ISIMIP') {
          return HttpResponse.json({ error: 'Wrong filtered request' }, { status: 400 });
        }
        return HttpResponse.json({
          indicators: [indicator('Heat')],
          failedInstances: [],
          filters: [
            {
              key: 'Data Source',
              label: 'Data source',
              color: '#000000',
              options: [{ value: 'ISIMIP', count: 1 }],
              selected: ['ISIMIP'],
            },
          ],
        });
      })
    );
    const catalog = createCatalog();
    catalog.indicatorFilters.set({ 'Data Source': ['ISIMIP'] });

    await catalog.loadFilteredIndicators({ region: 'DEU' });

    expect(get(catalog.filteredIndicators)).toMatchObject({
      status: 'success',
      data: { indicators: [{ id: 'Heat' }] },
    });
    expect(get(catalog.indicatorFilters)).toEqual({ 'Data Source': ['ISIMIP'] });
  });

  test('keeps the filtered result context fixed to the values sent with its request', async () => {
    server.use(http.get(`${API_URL}/indicators`, () => HttpResponse.json({ indicators: [indicator('Heat')], failedInstances: [], filters: [] })));
    const catalog = createCatalog();
    const filters = { Sector: ['Health'] };

    await catalog.loadFilteredIndicators({ region: 'DEU', filters });
    filters.Sector.push('Water');

    expect(get(catalog.filteredIndicators).data.context).toEqual({ region: 'DEU', filters: { Sector: ['Health'] } });
  });

  test('loads first-use filter groups without applying active filters', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, ({ request }) => {
        if (new URL(request.url).search !== '?Sector=') return HttpResponse.json({ error: 'Missing blank facet query' }, { status: 400 });
        return HttpResponse.json({
          indicators: [indicator('Heat')],
          failedInstances: [],
          filters: [
            {
              key: 'Data Source',
              label: 'Data source',
              color: '#000000',
              options: [{ value: 'ISIMIP', count: 1 }],
              selected: [],
            },
          ],
        });
      })
    );
    const catalog = createCatalog();
    catalog.indicatorFilters.set({ 'Data Source': ['ISIMIP'] });

    await catalog.loadFilterGroups();

    expect(get(catalog.filterGroups)).toMatchObject({
      status: 'success',
      data: {
        filters: [
          {
            key: 'Data Source',
            options: [{ value: 'ISIMIP', count: 1 }],
            selected: [],
          },
        ],
      },
    });
  });

  test('loads the full indicator index without accepting filter input', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, ({ request }) => {
        if (new URL(request.url).search) return HttpResponse.json({ error: 'Unexpected index query' }, { status: 400 });
        return HttpResponse.json({ indicators: [indicator('Heat')], failedInstances: [], filters: [] });
      })
    );
    const catalog = createCatalog();

    await catalog.loadIndicatorIndex({ region: 'DEU', filters: { time: ['Annual'] } });

    expect(get(catalog.indicatorIndex)).toMatchObject({
      status: 'success',
      data: { indicators: [{ id: 'Heat' }] },
    });
  });

  test.each([
    { incomplete: { id: 'Heat' }, reason: 'missing instance' },
    { incomplete: { instance: 'provide-internal' }, reason: 'missing id' },
    { incomplete: { id: 'Heat', instance: '' }, reason: 'empty instance' },
  ])('ignores indicator selection input with $reason', ({ incomplete }) => {
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Flood', instance: 'provide-internal' });
    catalog.selectParameters({ time: 'Annual' });
    catalog.selectScenarios(['Low Demand']);

    catalog.selectIndicator(incomplete);

    expect(get(catalog.selection)).toMatchObject({
      indicator: { id: 'Flood', instance: 'provide-internal' },
      parameters: { time: 'Annual' },
      scenarios: ['Low Demand'],
    });
  });

  test('clears the indicator and its dependent choices when asked explicitly', () => {
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Flood', instance: 'provide-internal' });
    catalog.selectParameters({ time: 'Annual' });
    catalog.selectScenarios(['Low Demand']);

    catalog.selectIndicator(undefined);

    expect(get(catalog.selection)).toMatchObject({
      indicator: undefined,
      parameters: {},
      scenarios: [],
    });
  });

  test('saves and restores the indicator id and instance as one value', () => {
    const { storage, values } = memoryStorage([['indicator', JSON.stringify({ id: 'Heat', instance: 'provide-external' })]]);

    const restored = createCatalog({ storage });
    expect(get(restored.selection).indicator).toEqual({ id: 'Heat', instance: 'provide-external' });
    expect(get(restored.pendingSelection)).toEqual({ indicator: 'Heat', instance: 'provide-external' });

    restored.selectIndicator({ id: 'Flood', instance: 'provide-internal' });
    expect(JSON.parse(values.get('indicator'))).toEqual({ id: 'Flood', instance: 'provide-internal' });
  });

  test('does not restore the old id-only indicator storage value', () => {
    const { storage, values } = memoryStorage([['indicator', 'Heat']]);

    const catalog = createCatalog({ storage });

    expect(get(catalog.selection).indicator).toBeUndefined();
    expect(values.has('indicator')).toBe(false);
  });

  test('confirms a restored indicator only after matching index success', async () => {
    server.use(http.get(`${API_URL}/indicators`, () => HttpResponse.json({ indicators: [indicator('Heat')], failedInstances: [] })));
    const { storage } = memoryStorage([['indicator', JSON.stringify({ id: 'Heat', instance: 'provide-internal' })]]);
    const catalog = createCatalog({ storage });

    expect(get(catalog.pendingSelection)).toEqual({ indicator: 'Heat', instance: 'provide-internal' });
    await catalog.loadIndicatorIndex();

    expect(get(catalog.selection).indicator).toEqual({ id: 'Heat', instance: 'provide-internal' });
    expect(get(catalog.pendingSelection)).toEqual({});
  });

  test('clears a restored indicator after its source confirms it is absent', async () => {
    server.use(http.get(`${API_URL}/indicators`, () => HttpResponse.json({ indicators: [indicator('Flood')], failedInstances: [] })));
    const { storage, values } = memoryStorage([['indicator', JSON.stringify({ id: 'Heat', instance: 'provide-internal' })]]);
    const catalog = createCatalog({ storage });

    expect(get(catalog.pendingSelection)).toEqual({ indicator: 'Heat', instance: 'provide-internal' });
    await catalog.loadIndicatorIndex();

    expect(get(catalog.selection).indicator).toBeUndefined();
    expect(get(catalog.pendingSelection)).toEqual({});
    expect(values.has('indicator')).toBe(false);
  });

  test('keeps a restored indicator pending when its source fails', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, () =>
        HttpResponse.json({
          indicators: [indicator('Flood', 'provide-external')],
          failedInstances: [{ instance: 'provide-internal', code: 'unavailable' }],
        })
      )
    );
    const { storage } = memoryStorage([['indicator', JSON.stringify({ id: 'Heat', instance: 'provide-internal' })]]);
    const catalog = createCatalog({ storage });

    expect(get(catalog.pendingSelection)).toEqual({ indicator: 'Heat', instance: 'provide-internal' });
    await catalog.loadIndicatorIndex();

    expect(get(catalog.selection).indicator).toEqual({ id: 'Heat', instance: 'provide-internal' });
    expect(get(catalog.pendingSelection)).toEqual({ indicator: 'Heat', instance: 'provide-internal' });
  });

  test('keeps a pending indicator when its source failed in the full index', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, () =>
        HttpResponse.json({
          indicators: [indicator('Heat', 'provide-external')],
          failedInstances: [{ instance: 'provide-internal', code: 'unavailable' }],
        })
      )
    );
    const catalog = createCatalog();
    catalog.setPendingSelection({ indicator: 'Heat', instance: 'provide-internal' });

    await catalog.loadIndicatorIndex();

    expect(get(catalog.selection).indicator).toEqual({ id: 'Heat', instance: 'provide-internal' });
    expect(get(catalog.pendingSelection)).toMatchObject({
      indicator: 'Heat',
      instance: 'provide-internal',
    });
  });

  test('clears a pending indicator when its source succeeded without it', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, () =>
        HttpResponse.json({
          indicators: [indicator('Flood', 'provide-internal')],
          failedInstances: [{ instance: 'provide-external', code: 'unavailable' }],
        })
      )
    );
    const catalog = createCatalog();
    catalog.setPendingSelection({ indicator: 'Heat', instance: 'provide-internal' });

    await catalog.loadIndicatorIndex();

    expect(get(catalog.selection).indicator).toBeUndefined();
    expect(get(catalog.pendingSelection).indicator).toBeUndefined();
  });

  test('keeps a selected indicator when its source failed in a filtered index', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, () =>
        HttpResponse.json({
          indicators: [indicator('Flood', 'provide-external')],
          failedInstances: [{ instance: 'provide-internal', code: 'unavailable' }],
          filters: [],
        })
      )
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });
    catalog.selectGeography('DEU');

    await catalog.loadFilteredIndicators({ region: 'DEU' });

    expect(get(catalog.selection).indicator).toEqual({ id: 'Heat', instance: 'provide-internal' });
  });

  test('clears a filtered indicator when its source succeeded without it', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, () =>
        HttpResponse.json({
          indicators: [indicator('Flood', 'provide-internal')],
          failedInstances: [{ instance: 'provide-external', code: 'unavailable' }],
          filters: [],
        })
      )
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });

    await catalog.loadFilteredIndicators();

    expect(get(catalog.selection).indicator).toBeUndefined();
    expect(get(catalog.filteredIndicators)).toMatchObject({
      status: 'success',
      data: { indicators: [{ id: 'Flood' }] },
    });
  });

  test('keeps a geography pending until its successful index proves it invalid', async () => {
    server.use(
      http.get(`${API_URL}/geographies`, async () => {
        await delay(30);
        return HttpResponse.json([{ id: 'ESP', label: 'Spain', geographyType: 'admin0' }]);
      }),
      http.get(`${API_URL}/geographies/types`, () => HttpResponse.json([{ id: 'admin0', label: 'Countries', isSelectable: true }]))
    );
    const catalog = createCatalog();
    catalog.setPendingSelection({ geography: 'DEU' });

    const load = catalog.loadGeographyIndex();
    expect(get(catalog.selection).geography).toBe('DEU');
    expect(get(catalog.pendingSelection).geography).toBe('DEU');
    await load;

    expect(get(catalog.selection).geography).toBeUndefined();
    expect(get(catalog.pendingSelection).geography).toBeUndefined();
  });

  test('keeps a geography pending when its index fails', async () => {
    server.use(
      http.get(`${API_URL}/geographies`, () => HttpResponse.json({ error: 'Unavailable' }, { status: 502 })),
      http.get(`${API_URL}/geographies/types`, () => HttpResponse.json([{ id: 'admin0', label: 'Countries', isSelectable: true }]))
    );
    const catalog = createCatalog();
    catalog.setPendingSelection({ geography: 'DEU' });

    await catalog.loadGeographyIndex();

    expect(get(catalog.geographyIndex).status).toBe('failure');
    expect(get(catalog.selection).geography).toBe('DEU');
    expect(get(catalog.pendingSelection).geography).toBe('DEU');
  });

  test('does not let an old geography index clear a newer user choice', async () => {
    server.use(
      http.get(`${API_URL}/geographies`, async () => {
        await delay(30);
        return HttpResponse.json([{ id: 'DEU', label: 'Germany', geographyType: 'admin0' }]);
      }),
      http.get(`${API_URL}/geographies/types`, () => HttpResponse.json([{ id: 'admin0', label: 'Countries', isSelectable: true }]))
    );
    const catalog = createCatalog();
    catalog.setPendingSelection({ geography: 'DEU' });

    const load = catalog.loadGeographyIndex();
    catalog.selectGeography('ESP');
    await load;

    expect(get(catalog.selection).geography).toBe('ESP');
    expect(get(catalog.pendingSelection).geography).toBeUndefined();
  });

  test('keeps a shared URL pending while its indicator index is slow', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, async () => {
        await delay(40);
        return HttpResponse.json({ indicators: [indicator('Heat')], failedInstances: [] });
      })
    );
    const catalog = createCatalog();
    catalog.setPendingSelection({
      indicator: 'Heat',
      instance: 'provide-internal',
      geography: 'DEU',
      parameters: { time: 'Annual' },
      scenarios: ['Low Demand'],
    });

    const load = catalog.loadIndicatorIndex();

    expect(get(catalog.indicatorIndex)).toEqual({ status: 'loading' });
    expect(get(catalog.pendingSelection)).toEqual({
      indicator: 'Heat',
      instance: 'provide-internal',
      geography: 'DEU',
      parameters: { time: 'Annual' },
      scenarios: ['Low Demand'],
    });
    expect(get(catalog.selection)).toEqual({
      indicator: { id: 'Heat', instance: 'provide-internal' },
      geography: 'DEU',
      parameters: { time: 'Annual' },
      scenarios: ['Low Demand'],
    });

    await load;

    expect(get(catalog.selection).indicator).toEqual({ id: 'Heat', instance: 'provide-internal' });
    expect(get(catalog.pendingSelection)).toEqual({
      geography: 'DEU',
      parameters: { time: 'Annual' },
      scenarios: ['Low Demand'],
    });
  });

  test('does not let slow URL validation replace a newer user choice', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, async () => {
        await delay(30);
        return HttpResponse.json({
          indicators: [indicator('Heat'), indicator('Flood')],
          failedInstances: [],
        });
      })
    );
    const catalog = createCatalog();
    catalog.setPendingSelection({ indicator: 'Heat', instance: 'provide-internal' });

    const load = catalog.loadIndicatorIndex();
    catalog.selectIndicator({ id: 'Flood', instance: 'provide-internal' });
    await load;

    expect(get(catalog.selection).indicator).toEqual({ id: 'Flood', instance: 'provide-internal' });
  });

  test('does not let an old filtered result clear a newer indicator', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, async () => {
        await delay(30);
        return HttpResponse.json({
          indicators: [indicator('Flood')],
          failedInstances: [],
          filters: [],
        });
      })
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });

    const load = catalog.loadFilteredIndicators();
    catalog.selectIndicator({ id: 'Drought', instance: 'provide-internal' });
    await load;

    expect(get(catalog.selection).indicator).toEqual({ id: 'Drought', instance: 'provide-internal' });
    expect(get(catalog.filteredIndicators)).toMatchObject({
      status: 'success',
      data: { indicators: [{ id: 'Flood' }] },
    });
  });

  test('keeps settled filtered data when the user selects from it', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, () =>
        HttpResponse.json({
          indicators: [indicator('Heat')],
          failedInstances: [],
          filters: [],
        })
      )
    );
    const catalog = createCatalog();
    await catalog.loadFilteredIndicators();

    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });

    expect(get(catalog.filteredIndicators)).toMatchObject({
      status: 'success',
      data: { indicators: [{ id: 'Heat' }] },
    });
  });

  test('does not let an old filtered result replace new pending input', async () => {
    server.use(
      http.get(`${API_URL}/indicators`, async () => {
        await delay(30);
        return HttpResponse.json({
          indicators: [indicator('Flood')],
          failedInstances: [],
          filters: [],
        });
      })
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });

    const load = catalog.loadFilteredIndicators();
    catalog.setPendingSelection({ indicator: 'Drought', instance: 'provide-internal' });
    await load;

    expect(get(catalog.selection).indicator).toEqual({ id: 'Drought', instance: 'provide-internal' });
    expect(get(catalog.pendingSelection)).toMatchObject({
      indicator: 'Drought',
      instance: 'provide-internal',
    });
    expect(get(catalog.filteredIndicators).status).toBe('success');
  });

  test('keeps choices when indicator details fail', async () => {
    server.use(http.get(`${APP_URL}/indicator-details/Heat`, () => HttpResponse.json({ error: 'Unavailable' }, { status: 502 })));
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });
    catalog.selectParameters({ time: 'Seasonal' });

    await catalog.loadIndicatorDetails();

    expect(get(catalog.selection)).toMatchObject({
      indicator: { id: 'Heat', instance: 'provide-internal' },
      parameters: { time: 'Seasonal' },
    });
    expect(get(catalog.indicatorDetails)).toEqual({ status: 'failure', error: 'Unavailable' });
  });

  test.each([
    { response: { id: 'Flood', instance: 'provide-internal' }, mismatch: 'wrong id' },
    { response: { id: 'Heat', instance: 'provide-external' }, mismatch: 'wrong instance' },
  ])('rejects indicator details with a $mismatch', async ({ response }) => {
    server.use(
      http.get(`${APP_URL}/indicator-details/Heat`, () =>
        HttpResponse.json({
          ...response,
          unit: 'days',
          parameters: [],
          models: [],
          sources: [],
        })
      )
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });
    catalog.selectParameters({ time: 'Annual' });

    await catalog.loadIndicatorDetails();

    expect(get(catalog.indicatorDetails)).toEqual({
      status: 'failure',
      error: 'Indicator detail response does not match the request',
    });
    expect(get(catalog.selection).parameters).toEqual({ time: 'Annual' });
  });

  test('clears a geography only after a successful empty availability result', async () => {
    server.use(
      http.get(`${API_URL}/geography-availability`, async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('indicator') !== 'Heat' || url.searchParams.get('instance') !== 'provide-internal') {
          return HttpResponse.json({ error: 'Wrong source-bound request' }, { status: 400 });
        }
        await delay(30);
        return HttpResponse.json({ geographyIds: [] });
      })
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });
    catalog.selectGeography('DEU');

    const load = catalog.loadGeographyAvailability();
    expect(get(catalog.selection).geography).toBe('DEU');

    await load;

    expect(get(catalog.selection).geography).toBeUndefined();
  });

  test('keeps loading scenario details after automatic geography cleanup', async () => {
    server.use(
      http.get(`${API_URL}/geography-availability`, () => HttpResponse.json({ geographyIds: [] })),
      http.get(`${API_URL}/scenario-availability`, async () => {
        await delay(30);
        return HttpResponse.json({ scenarios: [{ id: 'Low Demand', label: 'Low Demand' }] });
      }),
      http.get(`${APP_URL}/scenario-details/High%20Renewables`, async () => {
        await delay(30);
        return HttpResponse.json({
          id: 'High Renewables',
          label: 'High Renewables',
          instance: 'provide-internal',
          yearStart: 2020,
          yearStep: 5,
          yearEnd: 2100,
          characteristics: {},
        });
      })
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });
    catalog.selectGeography('DEU');
    catalog.selectScenarios(['High Renewables']);

    const availability = catalog.loadPercentileAvailability();
    const details = catalog.loadScenarioDetails('High Renewables');
    await catalog.loadGeographyAvailability();
    await Promise.all([availability, details]);

    expect(get(catalog.selection)).toMatchObject({
      geography: undefined,
      scenarios: ['High Renewables'],
    });
    expect(get(catalog.percentileAvailability)).toEqual({ status: 'idle' });
    expect(get(catalog.scenarioDetails)).toMatchObject({
      status: 'success',
      data: { id: 'High Renewables', instance: 'provide-internal' },
    });
  });

  test('keeps settled scenario details while geography changes invalidate availability', async () => {
    server.use(
      http.get(`${API_URL}/scenario-availability`, () => HttpResponse.json({ scenarios: [{ id: 'Low Demand', label: 'Low Demand' }] })),
      http.get(`${APP_URL}/scenario-details/Low%20Demand`, () =>
        HttpResponse.json({
          id: 'Low Demand',
          label: 'Low Demand',
          instance: 'provide-internal',
          yearStart: 2020,
          yearStep: 5,
          yearEnd: 2100,
          characteristics: {},
        })
      )
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });
    catalog.selectGeography('DEU');
    catalog.selectScenarios(['Low Demand']);
    await Promise.all([catalog.loadPercentileAvailability(), catalog.loadWarmingLevelAvailability()]);
    await catalog.loadScenarioDetails('Low Demand');

    catalog.selectGeography('ESP');

    expect(get(catalog.percentileAvailability)).toEqual({ status: 'idle' });
    expect(get(catalog.warmingLevelAvailability)).toEqual({ status: 'idle' });
    expect(get(catalog.scenarioDetails)).toMatchObject({
      status: 'success',
      data: { id: 'Low Demand', instance: 'provide-internal' },
    });
  });

  test('sends the selected instance to each source-bound endpoint', async () => {
    server.use(
      http.get(`${APP_URL}/indicator-details/Heat`, ({ request }) => {
        if (new URL(request.url).searchParams.get('instance') !== 'provide-external') {
          return HttpResponse.json({ error: 'Missing indicator instance' }, { status: 400 });
        }
        return HttpResponse.json({ id: 'Heat', instance: 'provide-external', unit: 'days', parameters: [], models: [], sources: [] });
      }),
      http.get(`${API_URL}/scenario-availability`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('instance') !== 'provide-external' || url.searchParams.get('indicator') !== 'Heat' || url.searchParams.get('region') !== 'DEU') {
          return HttpResponse.json({ error: 'Wrong scenario request' }, { status: 400 });
        }
        return HttpResponse.json({ scenarios: [] });
      }),
      http.get(`${APP_URL}/scenario-details/Low%20Demand`, ({ request }) => {
        if (new URL(request.url).searchParams.get('instance') !== 'provide-external') {
          return HttpResponse.json({ error: 'Missing scenario instance' }, { status: 400 });
        }
        return HttpResponse.json({
          id: 'Low Demand',
          label: 'Low Demand',
          instance: 'provide-external',
          yearStart: 2020,
          yearStep: 5,
          yearEnd: 2100,
          characteristics: {},
        });
      })
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-external' });
    catalog.selectGeography('DEU');

    await catalog.loadIndicatorDetails();
    await catalog.loadPercentileAvailability();
    await catalog.loadScenarioDetails('Low Demand');

    expect(get(catalog.indicatorDetails).status).toBe('success');
    expect(get(catalog.percentileAvailability).status).toBe('success');
    expect(get(catalog.scenarioDetails).status).toBe('success');
    expect(get(catalog.selectedInstance)).toBe('provide-external');
  });

  test('loads percentile and warming-level availability at the same time', async () => {
    server.use(
      http.get(`${API_URL}/scenario-availability`, async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('instance') !== 'provide-external' || url.searchParams.get('time') !== 'Annual') {
          return HttpResponse.json({ error: 'Missing source input' }, { status: 400 });
        }
        const axis = url.searchParams.get('axis');
        if (axis === 'warmingLevel') {
          await delay(10);
          return HttpResponse.json({ scenarios: [{ id: 'High Renewables' }] });
        }
        if (axis === 'percentile') {
          await delay(40);
          return HttpResponse.json({ scenarios: [{ id: 'Low Demand' }] });
        }
        return HttpResponse.json({ error: 'Missing axis' }, { status: 400 });
      })
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-external' });
    catalog.selectGeography('DEU');
    catalog.selectParameters({ time: 'Annual' });
    catalog.selectScenarios(['Low Demand']);

    const percentile = catalog.loadPercentileAvailability();
    await catalog.loadWarmingLevelAvailability();

    expect(get(catalog.warmingLevelAvailability)).toMatchObject({
      status: 'success',
      data: { scenarios: [{ id: 'High Renewables' }] },
    });
    expect(get(catalog.percentileAvailability)).toEqual({ status: 'loading' });

    await percentile;
    expect(get(catalog.percentileAvailability)).toMatchObject({
      status: 'success',
      data: {
        context: {
          indicator: { id: 'Heat', instance: 'provide-external' },
          geography: 'DEU',
          parameters: { time: 'Annual' },
        },
        scenarios: [{ id: 'Low Demand' }],
      },
    });
    expect(get(catalog.warmingLevelAvailability)).toMatchObject({
      status: 'success',
      data: { scenarios: [{ id: 'High Renewables' }] },
    });
  });

  test.each([
    { response: { id: 'Other', instance: 'provide-internal' }, mismatch: 'wrong id' },
    { response: { id: 'Low Demand', instance: 'provide-external' }, mismatch: 'wrong instance' },
  ])('rejects scenario details with a $mismatch', async ({ response }) => {
    server.use(
      http.get(`${APP_URL}/scenario-details/Low%20Demand`, () =>
        HttpResponse.json({
          ...response,
          label: 'Low Demand',
          yearStart: 2020,
          yearStep: 5,
          yearEnd: 2100,
          characteristics: {},
        })
      )
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });

    await catalog.loadScenarioDetails('Low Demand');

    expect(get(catalog.scenarioDetails)).toEqual({
      status: 'failure',
      error: 'Scenario detail response does not match the request',
    });
  });

  test('clears invalid parameter values only after matching detail success', async () => {
    server.use(
      http.get(`${APP_URL}/indicator-details/Heat`, async () => {
        await delay(40);
        return HttpResponse.json({
          id: 'Heat',
          instance: 'provide-internal',
          unit: 'days',
          parameters: [{ id: 'time', label: 'Time', options: [{ id: 'Annual', label: 'Annual' }] }],
          models: [],
          sources: [],
        });
      }),
      http.get(`${APP_URL}/indicator-details/Flood`, () =>
        HttpResponse.json({
          id: 'Flood',
          instance: 'provide-internal',
          unit: 'days',
          parameters: [{ id: 'time', label: 'Time', options: [{ id: 'Monthly', label: 'Monthly' }] }],
          models: [],
          sources: [],
        })
      )
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });
    catalog.selectParameters({ time: 'Monthly' });

    const oldLoad = catalog.loadIndicatorDetails();
    expect(get(catalog.selection).parameters).toEqual({ time: 'Monthly' });
    catalog.selectIndicator({ id: 'Flood', instance: 'provide-internal' });
    await catalog.loadIndicatorDetails();
    await oldLoad;

    expect(get(catalog.selection)).toMatchObject({
      indicator: { id: 'Flood', instance: 'provide-internal' },
      parameters: { time: 'Monthly' },
    });
    expect(get(catalog.indicatorDetails)).toMatchObject({ status: 'success', data: { id: 'Flood' } });
  });

  test('keeps loading scenario details after automatic parameter cleanup', async () => {
    server.use(
      http.get(`${APP_URL}/indicator-details/Heat`, () =>
        HttpResponse.json({
          id: 'Heat',
          instance: 'provide-internal',
          unit: 'days',
          parameters: [{ id: 'time', label: 'Time', options: [{ id: 'Annual', label: 'Annual' }] }],
          models: [],
          sources: [],
        })
      ),
      http.get(`${API_URL}/scenario-availability`, async () => {
        await delay(30);
        return HttpResponse.json({ scenarios: [{ id: 'Low Demand', label: 'Low Demand' }] });
      }),
      http.get(`${APP_URL}/scenario-details/High%20Renewables`, async () => {
        await delay(30);
        return HttpResponse.json({
          id: 'High Renewables',
          label: 'High Renewables',
          instance: 'provide-internal',
          yearStart: 2020,
          yearStep: 5,
          yearEnd: 2100,
          characteristics: {},
        });
      })
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });
    catalog.selectGeography('DEU');
    catalog.selectParameters({ time: 'Monthly' });
    catalog.selectScenarios(['High Renewables']);

    const availability = catalog.loadPercentileAvailability();
    const details = catalog.loadScenarioDetails('High Renewables');
    await catalog.loadIndicatorDetails();
    await Promise.all([availability, details]);

    expect(get(catalog.selection)).toMatchObject({
      parameters: {},
      scenarios: ['High Renewables'],
    });
    expect(get(catalog.percentileAvailability)).toEqual({ status: 'idle' });
    expect(get(catalog.scenarioDetails)).toMatchObject({
      status: 'success',
      data: { id: 'High Renewables', instance: 'provide-internal' },
    });
  });

  test('keeps settled scenario details while parameter changes invalidate availability', async () => {
    server.use(
      http.get(`${API_URL}/scenario-availability`, () => HttpResponse.json({ scenarios: [{ id: 'Low Demand', label: 'Low Demand' }] })),
      http.get(`${APP_URL}/scenario-details/Low%20Demand`, () =>
        HttpResponse.json({
          id: 'Low Demand',
          label: 'Low Demand',
          instance: 'provide-internal',
          yearStart: 2020,
          yearStep: 5,
          yearEnd: 2100,
          characteristics: {},
        })
      )
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });
    catalog.selectGeography('DEU');
    catalog.selectParameters({ time: 'Annual' });
    catalog.selectScenarios(['Low Demand']);
    await Promise.all([catalog.loadPercentileAvailability(), catalog.loadWarmingLevelAvailability()]);
    await catalog.loadScenarioDetails('Low Demand');

    catalog.selectParameters({ time: 'Seasonal' });

    expect(get(catalog.percentileAvailability)).toEqual({ status: 'idle' });
    expect(get(catalog.warmingLevelAvailability)).toEqual({ status: 'idle' });
    expect(get(catalog.scenarioDetails)).toMatchObject({
      status: 'success',
      data: { id: 'Low Demand', instance: 'provide-internal' },
    });
  });

  test('filters invalid scenarios only after matching availability success', async () => {
    server.use(
      http.get(`${API_URL}/scenario-availability`, async () => {
        await delay(30);
        return HttpResponse.json({ scenarios: [{ id: 'Low Demand', label: 'Low Demand' }] });
      })
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });
    catalog.selectGeography('DEU');
    catalog.selectScenarios(['High Renewables', 'Low Demand']);

    const load = catalog.loadPercentileAvailability();
    expect(get(catalog.selection).scenarios).toEqual(['High Renewables', 'Low Demand']);
    await load;

    expect(get(catalog.selection).scenarios).toEqual(['Low Demand']);
  });

  test('a retry replaces failure with success without dropping the selection', async () => {
    let attempt = 0;
    server.use(
      http.get(`${APP_URL}/indicator-details/Heat`, () => {
        attempt += 1;
        if (attempt === 1) return HttpResponse.json({ error: 'Temporary failure' }, { status: 502 });
        return HttpResponse.json({ id: 'Heat', instance: 'provide-internal', unit: 'days', parameters: [], models: [], sources: [] });
      })
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });

    await catalog.loadIndicatorDetails();
    expect(get(catalog.indicatorDetails).status).toBe('failure');
    await catalog.loadIndicatorDetails();

    expect(get(catalog.indicatorDetails)).toMatchObject({ status: 'success', data: { id: 'Heat' } });
    expect(get(catalog.selection).indicator).toEqual({ id: 'Heat', instance: 'provide-internal' });
  });

  test('keeps nullable GMT cells as missing values', async () => {
    server.use(
      http.get(`${APP_URL}/scenario-details/Low%20Demand`, () =>
        HttpResponse.json({
          id: 'Low Demand',
          label: 'Low Demand',
          instance: 'provide-internal',
          yearStart: 2020,
          yearStep: 5,
          yearEnd: 2100,
          gmt: { data: [[1.1, null, 1.3]], yearStart: 2020, yearStep: 5, yearEnd: 2020 },
          characteristics: {},
        })
      )
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });

    await catalog.loadScenarioDetails('Low Demand');

    expect(get(catalog.scenarioDetails).data.gmt.data).toEqual([[1.1, null, 1.3]]);
  });

  test('clears settled scenario details when the indicator pair changes', async () => {
    server.use(
      http.get(`${APP_URL}/scenario-details/Low%20Demand`, () =>
        HttpResponse.json({
          id: 'Low Demand',
          label: 'Low Demand',
          instance: 'provide-internal',
          yearStart: 2020,
          yearStep: 5,
          yearEnd: 2100,
          characteristics: {},
        })
      )
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });
    await catalog.loadScenarioDetails('Low Demand');
    expect(get(catalog.scenarioDetails)).toMatchObject({
      status: 'success',
      data: { id: 'Low Demand', instance: 'provide-internal' },
    });

    catalog.selectIndicator({ id: 'Flood', instance: 'provide-external' });

    expect(get(catalog.scenarioDetails)).toEqual({ status: 'idle' });
  });

  test.each([[['High Renewables']], [[]]])('does not keep old scenario details after the selection becomes %j', async (nextScenarios) => {
    server.use(
      http.get(`${APP_URL}/scenario-details/Low%20Demand`, async () => {
        await delay(30);
        return HttpResponse.json({
          id: 'Low Demand',
          label: 'Low Demand',
          instance: 'provide-internal',
          yearStart: 2020,
          yearStep: 5,
          yearEnd: 2100,
          characteristics: {},
        });
      })
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });
    catalog.selectScenarios(['Low Demand']);

    const load = catalog.loadScenarioDetails('Low Demand');
    catalog.selectScenarios(nextScenarios);
    await load;

    expect(get(catalog.scenarioDetails)).toEqual({ status: 'idle' });
  });

  test.each([
    [[{ id: 'High Renewables', label: 'High Renewables' }], ['High Renewables']],
    [[], []],
  ])('invalidates old detail when availability changes scenarios to %j', async (available, expected) => {
    server.use(
      http.get(`${APP_URL}/scenario-details/Low%20Demand`, async () => {
        await delay(30);
        return HttpResponse.json({
          id: 'Low Demand',
          label: 'Low Demand',
          instance: 'provide-internal',
          yearStart: 2020,
          yearStep: 5,
          yearEnd: 2100,
          characteristics: {},
        });
      }),
      http.get(`${API_URL}/scenario-availability`, () => HttpResponse.json({ scenarios: available }))
    );
    const catalog = createCatalog();
    catalog.selectIndicator({ id: 'Heat', instance: 'provide-internal' });
    catalog.selectGeography('DEU');
    catalog.selectScenarios(['Low Demand']);

    const detail = catalog.loadScenarioDetails('Low Demand');
    await catalog.loadPercentileAvailability();
    await detail;

    expect(get(catalog.selection).scenarios).toEqual(expected);
    expect(get(catalog.scenarioDetails)).toEqual({ status: 'idle' });
  });
});

describe('reconcileConfirmedSelection', () => {
  test('keeps allowed values and clears confirmed incompatible values', () => {
    expect(reconcileConfirmedSelection({ current: 'DEU', allowed: ['DEU', 'ESP'] })).toBe('DEU');
    expect(reconcileConfirmedSelection({ current: 'DEU', allowed: [] })).toBeUndefined();
    expect(reconcileConfirmedSelection({ current: ['A', 'B'], allowed: ['B', 'C'] })).toEqual(['B']);
  });
});
