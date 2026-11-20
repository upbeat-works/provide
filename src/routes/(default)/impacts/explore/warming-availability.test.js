import { afterEach, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import { createRuntimeCatalog } from '$stores/runtime-catalog.js';
import { createCatalogFlow } from '$stores/catalog-flow.js';
import { observeWarmingAvailability } from './warming-availability.js';

afterEach(() => vi.unstubAllGlobals());

test('checks warming data only while visible, reuses it on return, and reloads changed parameters', async () => {
  let intersect;
  const disconnect = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback) {
        intersect = callback;
      }
      observe() {}
      disconnect = disconnect;
    }
  );
  const requests = [];
  let fail = false;
  const catalog = createRuntimeCatalog({
    fetch: async (input) => {
      const url = new URL(input, 'http://localhost');
      requests.push(url);
      if (url.pathname.includes('indicator-details')) return Response.json({ id: 'Heat', instance: 'source', parameters: [] });
      if (url.pathname.includes('geography-availability')) return Response.json({ geographyIds: ['France'] });
      if (fail && url.searchParams.get('axis') === 'warmingLevel') return Response.json({ error: 'Offline' }, { status: 503 });
      return Response.json({ scenarios: [{ id: 'Low', label: 'Low', yearStart: 2030, yearEnd: 2100 }] });
    },
  });
  const flow = createCatalogFlow(catalog);
  await flow.chooseGeography('France');
  await flow.chooseIndicator({ id: 'Heat', instance: 'source' });
  const action = observeWarmingAvailability(document.createElement('section'), { slug: 'unavoidable-risk', flow });
  const warmingRequests = () => requests.filter((url) => url.searchParams.get('axis') === 'warmingLevel');
  try {
    await Promise.resolve();
    expect(warmingRequests()).toHaveLength(0);
    intersect([{ isIntersecting: true }]);
    await vi.waitFor(() => expect(get(catalog.warmingLevelAvailability).status).toBe('success'));
    expect(warmingRequests()).toHaveLength(1);

    intersect([{ isIntersecting: false }]);
    intersect([{ isIntersecting: true }]);
    await Promise.resolve();
    expect(warmingRequests()).toHaveLength(1);

    await flow.changeParameters({ time: 'Seasonal' });
    await vi.waitFor(() => expect(get(catalog.warmingLevelAvailability).status).toBe('success'));
    expect(warmingRequests()).toHaveLength(2);
    expect(warmingRequests()[1].searchParams.get('time')).toBe('Seasonal');

    intersect([{ isIntersecting: false }]);
    await flow.changeParameters({ time: 'Annual' });
    expect(warmingRequests()).toHaveLength(2);
    fail = true;
    intersect([{ isIntersecting: true }]);
    await vi.waitFor(() => expect(get(catalog.warmingLevelAvailability).status).toBe('failure'));
    intersect([{ isIntersecting: true }]);
    await Promise.resolve();
    expect(warmingRequests()).toHaveLength(3);
    fail = false;
    await flow.retryWarmingLevelAvailability();
    expect(get(catalog.warmingLevelAvailability).status).toBe('success');
  } finally {
    action.destroy();
  }
  await flow.changeParameters({ time: 'Seasonal' });
  expect(warmingRequests()).toHaveLength(4);
  expect(disconnect).toHaveBeenCalledOnce();
});

test.each([
  { places: [], expected: [] },
  { places: ['France'], expected: ['Seasonal'] },
])('waits for the place check after the warming section remounts ($places)', async ({ places, expected }) => {
  let intersect;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback) {
        intersect = callback;
      }
      observe() {}
      disconnect() {}
    }
  );
  const rainPlaces = Promise.withResolvers();
  const rainWarmingParameters = [];
  const catalog = createRuntimeCatalog({
    fetch: async (input) => {
      const url = new URL(input, 'http://localhost');
      if (url.pathname.includes('indicator-details')) {
        const id = url.pathname.split('/').at(-1);
        const time = id === 'Rain' ? 'Seasonal' : 'Annual';
        return Response.json({ id, instance: 'source', parameters: [{ id: 'time', options: [{ id: time }] }] });
      }
      if (url.pathname.includes('geography-availability')) {
        if (url.searchParams.get('indicator') === 'Rain') return rainPlaces.promise;
        return Response.json({ geographyIds: ['France'] });
      }
      if (url.searchParams.get('indicator') === 'Rain' && url.searchParams.get('axis') === 'warmingLevel') {
        rainWarmingParameters.push(url.searchParams.get('time'));
      }
      return Response.json({ scenarios: [] });
    },
  });
  const flow = createCatalogFlow(catalog);
  const mount = () => observeWarmingAvailability(document.createElement('section'), { slug: 'unavoidable-risk', flow });
  await flow.chooseGeography('France');
  await flow.chooseIndicator({ id: 'Heat', instance: 'source' });
  const initialSection = mount();
  intersect([{ isIntersecting: true }]);
  await vi.waitFor(() => expect(get(catalog.warmingLevelAvailability).status).toBe('success'));

  const changingIndicator = flow.chooseIndicator({ id: 'Rain', instance: 'source' });
  initialSection.destroy();
  await vi.waitFor(() => expect(get(catalog.selection).parameters).toEqual({ time: 'Seasonal' }));
  const remountedSection = mount();
  try {
    intersect([{ isIntersecting: true }]);
    await Promise.resolve();
    expect(rainWarmingParameters).toEqual([]);
    expect(get(catalog.selection).geography).toBe('France');

    rainPlaces.resolve(Response.json({ geographyIds: places }));
    await changingIndicator;
    expect(rainWarmingParameters).toEqual(expected);
    expect(get(catalog.selection).geography).toBe(places[0]);
  } finally {
    rainPlaces.resolve(Response.json({ geographyIds: places }));
    remountedSection.destroy();
  }
});

test('keeps loaded scenario availability when a place check retry confirms the selected place', async () => {
  let placeChecks = 0;
  const availabilityRequests = [];
  const catalog = createRuntimeCatalog({
    fetch: async (input) => {
      const url = new URL(input, 'http://localhost');
      if (url.pathname.includes('indicator-details')) return Response.json({ id: 'Heat', instance: 'source', parameters: [] });
      if (url.pathname.includes('geography-availability')) {
        placeChecks += 1;
        if (placeChecks === 1) return Response.json({ error: 'Offline' }, { status: 503 });
        return Response.json({ geographyIds: ['France'] });
      }
      availabilityRequests.push(url.searchParams.get('axis'));
      return Response.json({ scenarios: [] });
    },
  });
  const flow = createCatalogFlow(catalog);
  await flow.chooseGeography('France');
  flow.setWarmingVisible(true);
  await flow.chooseIndicator({ id: 'Heat', instance: 'source' });
  expect(get(catalog.geographyAvailability).status).toBe('failure');
  expect(get(catalog.percentileAvailability).status).toBe('success');
  await vi.waitFor(() => expect(get(catalog.warmingLevelAvailability).status).toBe('success'));
  availabilityRequests.length = 0;

  await flow.retryGeographyAvailability();

  expect(get(catalog.geographyAvailability).status).toBe('success');
  expect(get(catalog.selection).geography).toBe('France');
  expect(availabilityRequests).toEqual([]);
});
