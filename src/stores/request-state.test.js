import { describe, expect, test } from 'vitest';
import { get } from 'svelte/store';
import { createLatestRequest } from './request-state.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  void promise.catch(() => {});
  return { promise, resolve, reject };
}

describe('createLatestRequest', () => {
  test('starts idle', () => {
    const request = createLatestRequest(() => Promise.resolve('unused'));

    expect(get(request.state)).toEqual({ status: 'idle' });
  });

  test('reports loading as soon as a request starts', () => {
    const pending = deferred();
    const request = createLatestRequest(() => pending.promise);

    request.run('Heat');

    expect(get(request.state)).toEqual({ status: 'loading' });
  });

  test('stores successful data', async () => {
    const request = createLatestRequest(() => Promise.resolve({ id: 'Heat' }));

    await request.run('Heat');

    expect(get(request.state)).toEqual({ status: 'success', data: { id: 'Heat' } });
  });

  test('stores a useful failure', async () => {
    const request = createLatestRequest(() => Promise.reject(new Error('Network unavailable')));

    await request.run('Heat');

    expect(get(request.state)).toEqual({ status: 'failure', error: 'Network unavailable' });
  });

  test('retries by running again', async () => {
    let attempt = 0;
    const request = createLatestRequest(() => {
      attempt += 1;
      if (attempt === 1) return Promise.reject(new Error('Temporary failure'));
      return Promise.resolve({ id: 'Heat' });
    });

    await request.run('Heat');
    expect(get(request.state)).toEqual({ status: 'failure', error: 'Temporary failure' });

    const retry = request.run('Heat');
    expect(get(request.state)).toEqual({ status: 'loading' });
    await retry;
    expect(get(request.state)).toEqual({ status: 'success', data: { id: 'Heat' } });
  });

  test('clears current data and returns to idle', async () => {
    const request = createLatestRequest(() => Promise.resolve({ id: 'Heat' }));
    await request.run('Heat');

    request.clear();

    expect(get(request.state)).toEqual({ status: 'idle' });
  });

  test('keeps the newer result when an older request succeeds last', async () => {
    const first = deferred();
    const second = deferred();
    const requests = { A: first, B: second };
    const request = createLatestRequest((input) => requests[input].promise);

    const firstRun = request.run('A');
    const secondRun = request.run('B');
    second.resolve('B result');
    await secondRun;
    first.resolve('A result');
    await firstRun;

    expect(get(request.state)).toEqual({ status: 'success', data: 'B result' });
  });

  test('keeps the newer result when an older request fails last', async () => {
    const first = deferred();
    const second = deferred();
    const requests = { A: first, B: second };
    const request = createLatestRequest((input) => requests[input].promise);

    const firstRun = request.run('A');
    const secondRun = request.run('B');
    second.resolve('B result');
    await secondRun;
    first.reject(new Error('A failed'));
    await firstRun;

    expect(get(request.state)).toEqual({ status: 'success', data: 'B result' });
  });

  test('stays idle when an older request finishes after the newer result is cleared', async () => {
    const first = deferred();
    const second = deferred();
    const requests = { A: first, B: second };
    const request = createLatestRequest((input) => requests[input].promise);

    const firstRun = request.run('A');
    const secondRun = request.run('B');
    second.resolve('B result');
    await secondRun;
    request.clear();
    first.resolve('A result');
    await firstRun;

    expect(get(request.state)).toEqual({ status: 'idle' });
  });
});
