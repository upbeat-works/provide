import { expect, test, vi } from 'vitest';
import { startMapGridLoad } from './map-grid-loader.js';

const requests = ['Low Demand', '2020 Climate Policies'].map((scenario) => ({
  base: '/api', endpoint: 'impact-geo', params: { scenario, year: 2050 },
}));

function setup() {
  const worker = { postMessage: vi.fn(), terminate: vi.fn() };
  const set = vi.fn();
  const cancel = startMapGridLoad(requests, set, { createWorker: () => worker, baseUrl: 'https://app.test/embed/map' });
  return { worker, set, cancel };
}

test('loads ordered scenarios using absolute URLs and releases the worker when done', () => {
  const { worker, set } = setup();
  expect(worker.postMessage).toHaveBeenCalledWith(requests.map(({ params }) => ({
    url: `https://app.test/api/impact-geo/?${new URLSearchParams(params)}`, params,
  })));
  worker.onmessage({ data: { index: 0, result: { status: 'success', data: { year: 2050 } } } });
  expect(set.mock.lastCall[0]).toEqual([{ status: 'success', data: { year: 2050 } }, { status: 'loading', data: null }]);
  worker.onmessage({ data: { index: 1, result: { status: 'success', data: { year: 2050 } } } });
  expect(set.mock.lastCall[0].every(({ status }) => status === 'success')).toBe(true);
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});

test('cancels old work and ignores late results when a selection changes or a map closes', () => {
  const { worker, set, cancel } = setup();
  cancel();
  const calls = set.mock.calls.length;
  worker.onmessage?.({ data: { index: 0, result: { status: 'success', data: 'old' } } });
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  expect(set).toHaveBeenCalledTimes(calls);
});

test('settles the comparison and releases the worker after one scenario fails', () => {
  const { worker, set } = setup();
  worker.onmessage({
    data: {
      index: 0,
      result: { status: 'failed', message: 'GeoServer unavailable', isExpected: false },
    },
  });
  expect(set.mock.lastCall[0]).toEqual(requests.map(() => ({
    status: 'failed', message: 'GeoServer unavailable', isExpected: false,
  })));
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});

test.each(['onerror', 'onmessageerror'])('reports a worker failure through %s and allows a fresh load', (event) => {
  const { worker, set } = setup();
  worker[event]?.({ preventDefault() {} });
  expect(set.mock.lastCall[0]).toEqual(requests.map(() => ({ status: 'failed', message: 'Map worker failed' })));
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  const retry = setup();
  expect(retry.worker.postMessage).toHaveBeenCalledTimes(1);
  retry.cancel();
});

test('reports worker startup failures so the map can offer retry', () => {
  const set = vi.fn();
  startMapGridLoad(requests, set, { createWorker: () => { throw new Error('Worker unavailable'); }, baseUrl: 'https://app.test' });
  expect(set.mock.lastCall[0]).toEqual(requests.map(() => ({ status: 'failed', message: 'Worker unavailable' })));
});
