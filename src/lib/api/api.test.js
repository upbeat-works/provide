// @vitest-environment node
import { afterEach, beforeAll, afterAll, describe, expect, test, vi } from 'vitest';
import { get, writable } from 'svelte/store';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { fetchData } from './api.js';

vi.mock('$app/environment', () => ({ browser: true }));

const server = setupServer();
const widgets = new Set();
beforeAll(() => {
  vi.stubGlobal('window', new EventTarget());
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  for (const store of widgets) fetchData(store);
  widgets.clear();
  server.resetHandlers();
});
afterAll(() => {
  vi.unstubAllGlobals();
  server.close();
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function request(endpoint) {
  return { base: 'https://charts.example', endpoint, params: { geography: 'Algeria' } };
}

function createWidget() {
  const store = writable();
  widgets.add(store);
  return store;
}

describe('chart requests', () => {
  test('uses each grouped request base and repeated array format', async () => {
    let requested;
    server.use(http.get('https://maps.example/impact-geo/', ({ request }) => {
      requested = new URL(request.url);
      return HttpResponse.json({ values: [1] });
    }));
    const store = createWidget();
    fetchData(store, [{ base: 'https://maps.example', endpoint: 'impact-geo', arrayFormat: 'repeat', params: { scenarios: ['A', 'B'] } }]);
    await vi.waitFor(() => expect(get(store)[0].status).toBe('success'));
    expect(requested.searchParams.getAll('scenarios')).toEqual(['A', 'B']);
  });

  test('finishes a group of requests and retries its failed part', async () => {
    let attempts = 0;
    const delayed = deferred();
    server.use(
      http.get(/\/batch-one\//, () => {
        attempts += 1;
        if (attempts === 1) return HttpResponse.json({}, { status: 503 });
        return HttpResponse.json({ values: [1] });
      }),
      http.get(/\/batch-two\//, async () => {
        await delayed.promise;
        return HttpResponse.json({ values: [2] });
      })
    );
    const store = createWidget();
    const configs = [request('batch-one'), request('batch-two')];
    fetchData(store, configs);
    await vi.waitFor(() => expect(get(store)[0].status).toBe('failed'));
    expect(get(store)[1].status).toBe('loading');
    fetchData(store, configs);
    delayed.resolve();
    await vi.waitFor(() =>
      expect(get(store)).toEqual([
        { status: 'success', data: { values: [1] } },
        { status: 'success', data: { values: [2] } },
      ])
    );
  });

  test('completes all widgets waiting for the same response', async () => {
    const response = deferred();
    server.use(
      http.get('https://charts.example/shared/', async () => {
        await response.promise;
        return HttpResponse.json({ values: [1, 2] });
      })
    );
    const first = createWidget();
    const second = createWidget();
    fetchData(first, request('shared'));
    fetchData(second, request('shared'));
    expect(get(first).status).toBe('loading');
    expect(get(second).status).toBe('loading');
    response.resolve();
    await vi.waitFor(() => {
      expect(get(first)).toMatchObject({ status: 'success', data: { values: [1, 2] } });
      expect(get(second)).toEqual(get(first));
    });
  });

  test('retries a failed selection instead of keeping a cached error', async () => {
    let attempts = 0;
    server.use(
      http.get('https://charts.example/retry/', () => {
        attempts += 1;
        if (attempts === 1) return HttpResponse.json({ message: 'Unavailable' }, { status: 503 });
        return HttpResponse.json({ values: [3] });
      })
    );
    const store = createWidget();
    fetchData(store, request('retry'));
    await vi.waitFor(() => expect(get(store).status).toBe('failed'));
    fetchData(store, request('retry'));
    expect(get(store).status).toBe('loading');
    await vi.waitFor(() => expect(get(store)).toMatchObject({ status: 'success', data: { values: [3] } }));
  });

  test('keeps the latest selection when an older response arrives', async () => {
    const oldResponse = deferred();
    server.use(
      http.get('https://charts.example/old/', async () => {
        await oldResponse.promise;
        return HttpResponse.json({ values: [1] });
      }),
      http.get('https://charts.example/new/', () => HttpResponse.json({ values: [2] }))
    );
    const store = createWidget();
    const oldStore = createWidget();
    fetchData(store, request('old'));
    fetchData(oldStore, request('old'));
    fetchData(store, request('new'));
    await vi.waitFor(() => expect(get(store).data).toEqual({ values: [2] }));
    oldResponse.resolve();
    await vi.waitFor(() => expect(get(oldStore).status).toBe('success'));
    expect(get(store).data).toEqual({ values: [2] });
  });

  test('keeps a chart visible when a stale refresh fails', async () => {
    let now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    const delayed = deferred();
    let attempts = 0;
    server.use(http.get('https://charts.example/stale/', async () => {
      attempts += 1;
      if (attempts === 1) return HttpResponse.json({ values: [1] });
      await delayed.promise;
      return HttpResponse.json({ message: 'Unavailable' }, { status: 503 });
    }));
    const store = createWidget();
    const close = fetchData(store, request('stale'));
    try {
      const success = { status: 'success', data: { values: [1] } };
      await vi.waitFor(() => expect(get(store)).toEqual(success));
      now += 3600_001;
      window.dispatchEvent(new Event('focus'));
      await vi.waitFor(() => expect(attempts).toBe(2));
      expect(get(store)).toEqual(success);
      delayed.resolve();
      await vi.waitFor(() => expect(get(store)).toEqual(success));
    } finally {
      delayed.resolve();
      close();
      clock.mockRestore();
    }
  });

  test('aborts a request when its last widget closes', async () => {
    const delayed = deferred();
    let signal;
    server.use(http.get('https://charts.example/closing/', async ({ request }) => {
      signal = request.signal;
      await delayed.promise;
      return HttpResponse.json({ values: [1] });
    }));
    const first = createWidget();
    const second = createWidget();
    const stopFirst = fetchData(first, request('closing'));
    const stopSecond = fetchData(second, request('closing'));
    try {
      await vi.waitFor(() => expect(signal).toBeDefined());
      stopFirst?.();
      expect(signal.aborted).toBe(false);
      stopSecond?.();
      await vi.waitFor(() => expect(signal.aborted).toBe(true));
    } finally {
      delayed.resolve();
    }
  });
});
