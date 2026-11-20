import qs from 'qs';
import { browser } from '$app/environment';
import { END_AVOIDING_IMPACTS, END_AVOIDING_REFERENCE, END_GEO_SHAPE, END_IMPACT_TIME, END_UN_AVOIDABLE_RISK, STATUS_FAILED, STATUS_LOADING, STATUS_SUCCESS } from '$src/config';
import { HEAVY_TIMEOUT_MS, requestResources } from '$lib/requests/index.js';

const owners = new WeakMap();
const publicEndpoints = new Set([END_AVOIDING_IMPACTS, END_AVOIDING_REFERENCE, END_GEO_SHAPE, END_IMPACT_TIME, END_UN_AVOIDABLE_RISK]);
const loading = { status: STATUS_LOADING, data: null };
const success = (data) => ({ status: STATUS_SUCCESS, data });

function requestUrl({ endpoint, params, base, arrayFormat }) {
  const query = qs.stringify(params, {
    encodeValuesOnly: true,
    arrayFormat: arrayFormat ?? 'indices',
    sort: (left, right) => left.localeCompare(right),
  });
  return `${(base ?? import.meta.env.VITE_DATA_API_URL ?? '').replace(/\/$/, '')}/${endpoint}/?${query}`;
}

function validate(data) {
  if (data?.message) throw Object.assign(new Error(data.message), { isExpected: data.isExpected });
}

export function fetchData(store, config, { retry = false } = {}) {
  const previous = owners.get(store);
  if (!config) {
    previous?.stop();
    return;
  }

  const single = Boolean(config.endpoint && config.params);
  const entries = single ? [['0', config]] : Object.entries(config);
  const urls = entries.map(([key, entry]) => [key, requestUrl(entry), entry.endpoint]);
  const slots = new Map();

  function render() {
    if (owners.get(store) !== owner) return;
    const values = urls.map(([key, url]) => [key, slots.get(url)?.value ?? loading]);
    if (single) store.set(values[0][1]);
    else if (Array.isArray(config)) store.set(values.map(([, value]) => value));
    else store.set(Object.fromEntries(values));
  }

  const owner = {
    slots,
    render,
    stop() {
      if (owners.get(store) !== owner) return;
      owners.delete(store);
      for (const slot of slots.values()) slot.release();
    },
  };
  if (browser) {
    for (const [, url, endpoint] of urls) {
      if (slots.has(url)) continue;
      const existing = previous?.slots.get(url);
      if (!retry && existing?.value.status === STATUS_LOADING) {
        slots.set(url, existing);
        continue;
      }
      const lease = requestResources.acquire(url, { timeoutMs: HEAVY_TIMEOUT_MS, retry, validate, persist: publicEndpoints.has(endpoint) });
      const slot = { value: loading, release: lease.release };
      if (lease.success !== undefined) slot.value = success(lease.success);
      slots.set(url, slot);
      function publish(value) {
        if (value.status === STATUS_SUCCESS && slot.value.status === STATUS_SUCCESS && slot.value.data === value.data) return;
        slot.value = value;
        const current = owners.get(store);
        if (current?.slots.get(url) === slot) current.render();
      }
      const show = (data) => publish(success(data));
      lease.subscribe(show);
      lease.promise.then(show, (error) => {
        const body = error.data;
        publish({
          status: STATUS_FAILED,
          message: body?.message ?? error.message,
          isExpected: (body?.isExpected ?? error.isExpected) === true,
        });
      });
    }
  }

  owners.set(store, owner);
  for (const [url, slot] of previous?.slots ?? []) {
    if (slots.get(url) !== slot) slot.release();
  }
  render();
  return owner.stop;
}
