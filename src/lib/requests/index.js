import { CancelledError, QueryClient, QueryObserver, replaceEqualDeep } from '@tanstack/query-core';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/query-persist-client-core';
import { browserPersistence, limitSnapshot } from './persistence.js';

export const CATALOG_TIMEOUT_MS = 30_000;
export const HEAVY_TIMEOUT_MS = 60_000;
export const CMS_TIMEOUT_MS = 5_000;

const FRESH_MS = 60 * 60 * 1000;
const MAX_AGE_MS = 24 * FRESH_MS;
const SAVE_DELAY_MS = 250;
const RESTORE_TIMEOUT_MS = 1000;

function requestKey(url) {
  const [withoutFragment] = String(url).split('#', 1);
  const index = withoutFragment.indexOf('?');
  if (index === -1) return [withoutFragment];
  const params = new URLSearchParams(withoutFragment.slice(index + 1));
  params.sort();
  const query = params.toString();
  const path = withoutFragment.slice(0, index);
  return [query ? path + '?' + query : path];
}

export function isRequestDataStale(updatedAt) {
  return Date.now() - updatedAt >= FRESH_MS;
}

function abortError() {
  return new DOMException('The request was cancelled.', 'AbortError');
}

export async function withRequestDeadline(operation, { signal, timeoutMs = CATALOG_TIMEOUT_MS } = {}) {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(
    new DOMException('The request took too long.', 'TimeoutError'),
  ), timeoutMs);
  let rejectOnAbort;
  const cancelled = new Promise((_, reject) => {
    rejectOnAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', rejectOnAbort, { once: true });
  });
  try {
    return await Promise.race([Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return operation({ signal: controller.signal });
    }), cancelled]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', rejectOnAbort);
  }
}

async function fetchJson(url, { fetch = globalThis.fetch, signal, timeoutMs, ...init } = {}) {
  return withRequestDeadline(async ({ signal }) => {
    const response = await fetch(url, { ...init, signal });
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (response.ok) throw error;
    }
    if (!response.ok) {
      throw Object.assign(new Error(data?.message ?? data?.error ?? `Request failed with status code: ${response.status}`), {
        status: response.status,
        data,
        isExpected: data?.isExpected ?? false,
      });
    }
    const incomplete = response.headers?.get('x-content-incomplete') === 'true';
    const reusable = !incomplete && response.status !== 206 && !response.headers?.has('content-range')
      && !/\bno-store\b/i.test(response.headers?.get('cache-control') ?? '');
    const vary = response.headers?.get('vary')?.toLowerCase().split(',').map((name) => name.trim()) ?? [];
    return {
      data,
      incomplete,
      reusable,
      persistable: reusable && response.status === 200
        && /\bjson\b/i.test(response.headers?.get('content-type') ?? '')
        && !/\bprivate\b/i.test(response.headers?.get('cache-control') ?? '')
        && vary.every((name) => ['origin', 'accept-encoding'].includes(name)),
    };
  }, { signal, timeoutMs });
}

export async function requestJson(url, options) {
  return (await fetchJson(url, options)).data;
}

function uncachedResource(load, signal) {
  const controller = new AbortController();
  const release = () => controller.abort(signal?.reason ?? abortError());
  if (signal?.aborted) release();
  else signal?.addEventListener('abort', release, { once: true });
  const snapshot = Promise.resolve().then(() => load(controller.signal)).finally(() => {
    signal?.removeEventListener('abort', release);
  });
  const promise = snapshot.then(({ data }) => data);
  promise.catch(() => {});
  return { promise, snapshot, release, subscribe: () => () => {} };
}

class UncachedResult extends Error {
  constructor(snapshot) {
    super('The response cannot be cached.');
    this.snapshot = snapshot;
  }
}

export function createRequestResources({ fetch, persistence, maxInactive = Infinity } = {}) {
  const gcTime = typeof window === 'undefined' ? Infinity : MAX_AGE_MS;
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime,
        retry: false,
        structuralSharing: (previous, next) => next?.reusable ? replaceEqualDeep(previous, next) : next,
      },
    },
  });
  const cache = client.getQueryCache();
  let restoring;
  let saving = Promise.resolve();
  let saveTimer;
  const active = new Map();

  function refreshActive() {
    for (const refreshers of active.values()) refreshers.values().next().value();
  }

  function addActive(key, refresh) {
    if (!active.size && typeof window !== 'undefined') {
      window.addEventListener('focus', refreshActive);
      window.addEventListener('online', refreshActive);
    }
    if (!active.has(key)) active.set(key, new Set());
    const refreshers = active.get(key);
    refreshers.add(refresh);
    return () => {
      refreshers.delete(refresh);
      if (!refreshers.size) active.delete(key);
      if (!active.size && typeof window !== 'undefined') {
        window.removeEventListener('focus', refreshActive);
        window.removeEventListener('online', refreshActive);
      }
    };
  }
  const persistenceOptions = persistence && {
    queryClient: client,
    buster: 'public-json-v1',
    persister: {
      ...persistence,
      persistClient: (snapshot) => persistence.persistClient(limitSnapshot(snapshot, MAX_AGE_MS)),
      async restoreClient() {
        const snapshot = await withRequestDeadline(() => persistence.restoreClient(), {
          timeoutMs: RESTORE_TIMEOUT_MS,
        }).catch(() => undefined);
        if (snapshot) return limitSnapshot(snapshot, MAX_AGE_MS);
      },
    },
  };

  function restore() {
    if (!persistenceOptions) return;
    restoring ??= persistQueryClientRestore({ ...persistenceOptions, maxAge: MAX_AGE_MS }).catch(() => {});
    return restoring;
  }

  if (persistenceOptions) {
    cache.subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      if (!event.query.state.data?.persistIntent) return;
      if (saveTimer) return;
      saveTimer = setTimeout(() => {
        saveTimer = undefined;
        saving = saving.then(() => persistQueryClientSave({
          ...persistenceOptions,
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => query.state.data?.persistable === true,
          },
        })).catch(() => {});
      }, SAVE_DELAY_MS);
    });
  }

  function trimInactive() {
    if (maxInactive === Infinity) return;
    const inactive = cache.getAll().filter((query) => query.getObserversCount() === 0);
    inactive.sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
    for (const query of inactive.slice(maxInactive)) cache.remove(query);
  }

  function getEntry(url) {
    const state = client.getQueryState(requestKey(url));
    if (state?.data?.reusable && Date.now() - state.dataUpdatedAt < MAX_AGE_MS) return state;
  }

  function getSnapshot(url) {
    const entry = getEntry(url);
    if (entry) return { data: entry.data.data, updatedAt: entry.dataUpdatedAt };
  }

  return {
    getCached(url) {
      return getEntry(url)?.data.data;
    },
    acquire(url, {
      signal, timeoutMs, persist = false, validate, cacheWhen, load, retry = false,
      fetch: fetchRequest = fetch, ...init
    } = {}) {
      const method = init.method?.toUpperCase() ?? 'GET';
      const share = method === 'GET' && init.cache !== 'no-store' && !init.headers && !init.body
        && (init.credentials ?? 'same-origin') === 'same-origin';
      const getResponse = async (signal) => {
        let entry;
        if (load) entry = { data: await withRequestDeadline(load, { signal, timeoutMs }), reusable: true, persistable: false };
        else entry = await fetchJson(url, { ...init, fetch: fetchRequest, signal, timeoutMs });
        validate?.(entry.data);
        entry.persistable &&= persist && share;
        return entry;
      };
      if (!share || signal?.aborted) {
        return uncachedResource(async (signal) => {
          const { data, incomplete } = await getResponse(signal);
          return { data, incomplete, updatedAt: Date.now() };
        }, signal);
      }

      const queryKey = requestKey(url);
      const observer = new QueryObserver(client, { queryKey, enabled: false });
      const listeners = new Set();
      let { data: seen, dataUpdatedAt: seenAt } = observer.getCurrentResult();
      const unsubscribe = observer.subscribe(({ data, dataUpdatedAt }) => {
        if (!data || (seen === data && seenAt === dataUpdatedAt)) return;
        seen = data;
        seenAt = dataUpdatedAt;
        for (const listener of listeners) listener(data.data, { updatedAt: dataUpdatedAt });
      });
      let cancel;
      let released = false;
      let started = false;
      const release = () => {
        if (released) return;
        released = true;
        listeners.clear();
        signal?.removeEventListener('abort', release);
        unsubscribe();
        removeActive();
        const query = cache.find({ queryKey, exact: true });
        if (query?.state.data?.reusable === false && !query.getObserversCount()) cache.remove(query);
        cancel(signal?.reason ?? abortError());
        trimInactive();
      };
      const cancelled = new Promise((_, reject) => { cancel = reject; });
      signal?.addEventListener('abort', release, { once: true });
      const initial = getEntry(url);

      function fetchEntry() {
        return client.fetchQuery({
          queryKey,
          staleTime: 0,
          networkMode: 'always',
          async queryFn({ signal }) {
            const entry = await getResponse(signal);
            entry.persistIntent = persist || getEntry(url)?.data.persistable === true;
            if (entry.incomplete || (cacheWhen && !cacheWhen(entry.data))) {
              const complete = entry.incomplete && getSnapshot(url);
              throw new UncachedResult(complete || {
                data: entry.data,
                incomplete: entry.incomplete,
                updatedAt: Date.now(),
              });
            }
            return entry;
          },
        }).then(({ data }) => ({
          data,
          updatedAt: client.getQueryState(queryKey)?.dataUpdatedAt ?? Date.now(),
        }), (error) => {
          if (error instanceof UncachedResult) return error.snapshot;
          if (error instanceof CancelledError) throw abortError();
          throw error;
        });
      }

      const removeActive = addActive(queryKey[0], () => {
        const cached = getEntry(url);
        if (cached && !isRequestDataStale(cached.dataUpdatedAt)) return;
        const { data, isFetching } = observer.getCurrentResult();
        if (!started || isFetching || data?.reusable === false) return;
        fetchEntry().catch(() => {});
      });

      async function start() {
        if (persist && !initial) await restore();
        if (released) throw signal?.reason ?? abortError();
        started = true;
        const cached = getEntry(url);
        if (cached && !retry && !isRequestDataStale(cached.dataUpdatedAt)) return { data: cached.data.data, updatedAt: cached.dataUpdatedAt };
        if (retry) client.cancelQueries({ queryKey, exact: true }, { silent: true, revert: false });
        if (released) throw signal?.reason ?? abortError();
        const request = fetchEntry();
        if (cached && !retry) {
          request.catch(() => {});
          return { data: cached.data.data, updatedAt: cached.dataUpdatedAt };
        }
        return request;
      }

      const snapshot = Promise.race([start(), cancelled]).then((result) => {
        if (result.incomplete) {
          const { data, ...metadata } = result;
          for (const listener of listeners) listener(data, metadata);
        }
        return result;
      });
      const promise = snapshot.then(({ data }) => data);
      promise.catch(() => {});
      return {
        get success() { return getEntry(url)?.data.data; },
        get successSnapshot() { return getSnapshot(url); },
        promise,
        snapshot,
        release,
        subscribe(listener) {
          if (!released) listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    },
  };
}

let browserResources;
export const requestResources = {
  getCached(url) {
    return browserResources?.getCached(url);
  },
  acquire(url, options) {
    if (typeof window === 'undefined') return createRequestResources().acquire(url, options);
    browserResources ??= createRequestResources({ persistence: browserPersistence() });
    return browserResources.acquire(url, options);
  },
};
