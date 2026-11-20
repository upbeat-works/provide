import { HEAVY_TIMEOUT_MS, requestResources } from '$lib/requests/index.js';

export function resourceUrl(resource, sector, selection) {
  const params = new URLSearchParams({ sector });
  const dimensions = ['map', 'definition'].includes(resource) ? ['indicator', 'region', 'scenario', 'year'] : ['region', 'scenario', 'year'];
  for (const key of dimensions) {
    const value = selection[key];
    if (value?.uid) params.set(key, value.uid);
  }
  return `${resource}?${params}`;
}

export function startResource(resource, sector, selection, fetcher = fetch, { preview, signal, onError, retry } = {}) {
  const path = resourceUrl(resource, sector, selection);
  const options = { fetch: fetcher, signal, retry, timeoutMs: HEAVY_TIMEOUT_MS };
  let url = `/app/scoreboard/${path}`;
  if (preview !== undefined) {
    url = `/app/scoreboard/preview/${path}`;
    options.method = 'POST';
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(preview);
  } else {
    options.persist = true;
    options.cacheWhen = (data) => data.status !== 'error';
  }
  const lease = requestResources.acquire(url, options);
  const result = onError ? lease.promise.catch(onError) : lease.promise;
  return Object.assign(result, { lease });
}

export async function loadResource(...args) {
  const result = startResource(...args);
  try {
    return await result;
  } finally {
    result.lease.release();
  }
}

export function mapResourceKey(sector, selection = {}) {
  return resourceUrl('map', sector, selection);
}
