import { get, readonly, writable } from 'svelte/store';
import { isRequestDataStale } from '$lib/requests/index.js';

function errorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'Request failed';
}

export function createLatestRequest(load) {
  const requestState = writable({ status: 'idle' });
  let currentRequestId = 0;

  async function run(input) {
    const requestId = ++currentRequestId;

    try {
      let data = load(input);
      if (typeof data?.then === 'function') {
        requestState.set({ status: 'loading' });
        data = await data;
      }
      if (requestId !== currentRequestId) return;
      requestState.set({ status: 'success', data });
    } catch (error) {
      if (requestId !== currentRequestId) return;
      requestState.set({ status: 'failure', error: errorMessage(error) });
    }
  }

  function clear() {
    currentRequestId += 1;
    requestState.set({ status: 'idle' });
  }

  return {
    state: readonly(requestState),
    run,
    clear,
  };
}

export function createCatalogRequest(resources, path, { result = (data) => data, validate, onRefresh, ...options } = {}) {
  const state = writable({ status: 'idle' });
  let current;
  let currentUrl;
  let updatedAt = 0;
  let incomplete = false;

  function run(input, { retry = false } = {}) {
    const url = path(input);
    const lease = resources.acquire(url, { ...options, retry, validate: validate && ((data) => validate(data, input)) });
    const previous = current;
    const cached = lease.successSnapshot;
    const keepCurrent = cached !== undefined && currentUrl === url && get(state).status === 'success';
    current = lease;
    currentUrl = url;
    previous?.release();

    let seen;
    let seenAt = 0;
    let seenIncomplete = false;
    let settled = false;
    function show(data, { updatedAt: timestamp, incomplete: isIncomplete = false }) {
      if (current !== lease || timestamp < seenAt) return;
      const changed = seen !== data || seenIncomplete !== isIncomplete || isRequestDataStale(seenAt) !== isRequestDataStale(timestamp);
      seen = data;
      seenAt = timestamp;
      seenIncomplete = isIncomplete;
      updatedAt = timestamp;
      incomplete = isIncomplete;
      if (!changed) return;
      const next = result(data, input);
      state.set({ status: 'success', data: next });
      if (settled && isFresh() && current === lease) onRefresh?.(next, input);
    }

    if (retry) {
      if (!keepCurrent) state.set({ status: 'loading' });
    } else if (cached === undefined) {
      state.set({ status: 'loading' });
    } else {
      show(cached.data, cached);
    }
    lease.subscribe(show);
    return lease.snapshot.then((snapshot) => {
      show(snapshot.data, snapshot);
      settled = true;
    }, (error) => {
      if (current === lease && !keepCurrent) state.set({ status: 'failure', error: errorMessage(error) });
    });
  }

  function clear() {
    current?.release();
    current = undefined;
    currentUrl = undefined;
    state.set({ status: 'idle' });
  }

  function isFresh() {
    return get(state).status === 'success' && !incomplete && !isRequestDataStale(updatedAt);
  }

  return { state: readonly(state), run, clear, isFresh };
}
