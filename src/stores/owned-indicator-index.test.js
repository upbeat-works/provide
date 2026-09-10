import { describe, expect, test } from 'vitest';
import { get } from 'svelte/store';
import { indicatorControlAdapter } from './catalog-adapters.js';
import { createOwnedIndicatorIndexRequest } from './owned-indicator-index.js';

const initialIndex = {
  indicators: [{ id: 'Rain', uid: 'Rain', instance: 'working-source' }],
  failedInstances: [{ instance: 'failed-source', code: 'unavailable' }],
};

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

function controlView(ownedRequest) {
  return indicatorControlAdapter({
    ownedRequest,
    context: { mode: 'geography', geography: 'DEU', filters: {} },
    indexRequest: { status: 'failure', error: 'global index failed' },
    filteredRequest: { status: 'failure', error: 'global filter failed' },
  });
}

describe('owned indicator index retry', () => {
  test('keeps the current partial list visible while a retry loads', () => {
    const pending = deferred();
    const request = createOwnedIndicatorIndexRequest({ initialIndex, load: () => pending.promise });

    void request.retry();

    expect(get(request.state)).toEqual({ status: 'loading', data: initialIndex });
    expect(controlView(get(request.state))).toMatchObject({
      request: { status: 'success', data: initialIndex },
      ownedRetryStatus: 'loading',
      ownedRetryAvailable: false,
    });
  });

  test('keeps the partial list on failure and can retry successfully', async () => {
    const replacement = {
      indicators: [{ id: 'Heat', uid: 'Heat', instance: 'primary' }],
      failedInstances: [{ instance: 'failed-source', code: 'unavailable' }],
    };
    let attempt = 0;
    const request = createOwnedIndicatorIndexRequest({
      initialIndex,
      load: () => {
        attempt += 1;
        if (attempt === 1) return Promise.reject(new Error('private upstream detail'));
        return Promise.resolve(replacement);
      },
    });

    await request.retry();

    expect(get(request.state)).toEqual({ status: 'failure', error: 'private upstream detail', data: initialIndex });
    expect(controlView(get(request.state))).toMatchObject({
      request: { status: 'success', data: initialIndex },
      ownedRetryStatus: 'failure',
      ownedRetryAvailable: true,
    });

    await request.retry();

    expect(get(request.state)).toEqual({ status: 'success', data: replacement });
    expect(controlView(get(request.state))).toMatchObject({
      request: { status: 'success', data: replacement },
      ownedRetryStatus: 'success',
      ownedRetryAvailable: true,
    });
  });

  test('does not let an older retry overwrite the latest successful response', async () => {
    const first = deferred();
    const second = deferred();
    const pending = [first, second];
    const request = createOwnedIndicatorIndexRequest({ initialIndex, load: () => pending.shift().promise });
    const newer = { indicators: [{ id: 'New', uid: 'New', instance: 'primary' }], failedInstances: [] };
    const older = { indicators: [{ id: 'Old', uid: 'Old', instance: 'primary' }], failedInstances: [] };

    const firstRetry = request.retry();
    const secondRetry = request.retry();
    second.resolve(newer);
    await secondRetry;
    first.resolve(older);
    await firstRetry;

    expect(get(request.state)).toEqual({ status: 'success', data: newer });
  });
});
