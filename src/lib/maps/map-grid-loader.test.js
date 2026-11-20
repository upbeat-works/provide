import { expect, test, vi } from 'vitest';
import { createRequestResources } from '$lib/requests/index.js';
import { startMapGridLoad } from './map-grid-loader.js';

const requests = ['Low Demand', '2020 Climate Policies'].map((scenario) => ({
  base: '/api', endpoint: 'impact-geo', params: { scenario, year: 2050 },
}));

function setup() {
  const createWorker = vi.fn(() => ({ postMessage: vi.fn(), terminate: vi.fn() }));
  const resources = createRequestResources({ maxInactive: 4 });
  function open(selection = requests) {
    const set = vi.fn();
    const cancel = startMapGridLoad(selection, set, { createWorker, resources, baseUrl: 'https://app.test/embed/map' });
    return { set, cancel };
  }
  function worker(index) {
    return createWorker.mock.results[index]?.value;
  }
  function finish(index, result) {
    worker(index).onmessage({ data: { index: 0, result } });
  }
  return { createWorker, open, worker, finish };
}

const success = { status: 'success', data: { year: 2050 } };

test('shares a pending grid across maps until the last map closes', async () => {
  const { createWorker, open, worker } = setup();
  const first = open(requests.slice(0, 1));
  const second = open(requests.slice(0, 1));
  await vi.waitFor(() => expect(createWorker).toHaveBeenCalledTimes(1));
  first.cancel();
  expect(worker(0).terminate).not.toHaveBeenCalled();
  second.cancel();
  expect(worker(0).terminate).toHaveBeenCalledTimes(1);
});

test('loads each scenario using an absolute URL and renders results in selection order', async () => {
  const { createWorker, open, finish, worker } = setup();
  const { set, cancel } = open();
  await vi.waitFor(() => expect(createWorker).toHaveBeenCalledTimes(2));
  for (const [index, { params }] of requests.entries()) {
    expect(worker(index).postMessage).toHaveBeenCalledWith([{ url: `https://app.test/api/impact-geo/?${new URLSearchParams(params)}`, params }]);
  }
  finish(1, success);
  await vi.waitFor(() => expect(set.mock.lastCall[0]).toEqual([{ status: 'loading', data: null }, success]));
  finish(0, success);
  await vi.waitFor(() => expect(set.mock.lastCall[0]).toEqual([success, success]));
  expect(worker(0).terminate).toHaveBeenCalledTimes(1);
  expect(worker(1).terminate).toHaveBeenCalledTimes(1);
  cancel();
});

test('ignores late results from a worker after the map closes', async () => {
  const { createWorker, open, worker, finish } = setup();
  const { set, cancel } = open(requests.slice(0, 1));
  await vi.waitFor(() => expect(createWorker).toHaveBeenCalledTimes(1));
  cancel();
  const calls = set.mock.calls.length;
  finish(0, success);
  await Promise.resolve();
  expect(worker(0).terminate).toHaveBeenCalledTimes(1);
  expect(set).toHaveBeenCalledTimes(calls);
});

test('settles the comparison and releases its workers after one scenario fails', async () => {
  const { createWorker, open, worker, finish } = setup();
  const { set } = open();
  await vi.waitFor(() => expect(createWorker).toHaveBeenCalledTimes(2));
  const failure = { status: 'failed', message: 'GeoServer unavailable', isExpected: false };
  finish(0, failure);
  await vi.waitFor(() => expect(set.mock.lastCall[0]).toEqual([failure, failure]));
  expect(worker(0).terminate).toHaveBeenCalledTimes(1);
  expect(worker(1).terminate).toHaveBeenCalledTimes(1);
});

test.each(['onerror', 'onmessageerror'])('lets the map retry after a worker error through %s', async (event) => {
  const { createWorker, open, worker, finish } = setup();
  const { set } = open(requests.slice(0, 1));
  await vi.waitFor(() => expect(createWorker).toHaveBeenCalledTimes(1));
  worker(0)[event]?.({ preventDefault() {} });
  await vi.waitFor(() => expect(set.mock.lastCall[0]).toEqual([{ status: 'failed', message: 'Map worker failed' }]));
  const retry = open(requests.slice(0, 1));
  await vi.waitFor(() => expect(createWorker).toHaveBeenCalledTimes(2));
  finish(1, success);
  await vi.waitFor(() => expect(retry.set.mock.lastCall[0]).toEqual([success]));
  retry.cancel();
});

test('reports worker startup failures so the map can offer retry', async () => {
  const { open, createWorker } = setup();
  createWorker.mockImplementation(() => { throw new Error('Worker unavailable'); });
  const { set } = open();
  await vi.waitFor(() => expect(set.mock.lastCall[0]).toEqual(requests.map(() => ({ status: 'failed', message: 'Worker unavailable' }))));
});

test('can revisit only the four newest inactive grids without starting workers', async () => {
  const { open, worker, createWorker, finish } = setup();
  const grids = [2030, 2050, 2070, 2090, 2100].map((year) => [{ ...requests[0], params: { ...requests[0].params, year } }]);
  for (const [index, selection] of grids.entries()) {
    const map = open(selection);
    await vi.waitFor(() => expect(worker(index)).toBeDefined());
    const result = { status: 'success', data: selection[0].params };
    finish(index, result);
    await vi.waitFor(() => expect(map.set.mock.lastCall[0]).toEqual([result]));
    map.cancel();
  }
  for (const selection of grids.slice(1)) {
    const map = open(selection);
    expect(map.set.mock.lastCall[0]).toEqual([{ status: 'success', data: selection[0].params }]);
    map.cancel();
  }
  const first = open(grids[0]);
  await vi.waitFor(() => expect(createWorker).toHaveBeenCalledTimes(6));
  first.cancel();
});
