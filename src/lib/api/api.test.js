import { afterEach, beforeAll, afterAll, describe, expect, test, vi } from 'vitest';
import { get, writable } from 'svelte/store';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { fetchData } from './api.js';

vi.mock('$app/environment', () => ({ browser: true }));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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

describe('chart requests', () => {
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
    const store = writable();
    const configs = [
      { endpoint: 'batch-one', params: {} },
      { endpoint: 'batch-two', params: {} },
    ];
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
    const first = writable();
    const second = writable();
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
    const store = writable();
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
    const store = writable();
    const oldStore = writable();
    fetchData(store, request('old'));
    fetchData(oldStore, request('old'));
    fetchData(store, request('new'));
    await vi.waitFor(() => expect(get(store).data).toEqual({ values: [2] }));
    oldResponse.resolve();
    await vi.waitFor(() => expect(get(oldStore).status).toBe('success'));
    expect(get(store).data).toEqual({ values: [2] });
  });
});
