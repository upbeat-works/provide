import MapWorker from '../workers/impact-geo.js?worker';
import { createRequestResources, HEAVY_TIMEOUT_MS } from '$lib/requests/index.js';

const gridResources = createRequestResources({ maxInactive: 4 });
const loading = { status: 'loading', data: null };
const success = (data) => ({ status: 'success', data });

function loadGrid({ url, params, createWorker, signal }) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const worker = createWorker();
    let finished = false;
    function finish(callback, value) {
      if (finished) return;
      finished = true;
      signal.removeEventListener('abort', abort);
      worker.terminate();
      callback(value);
    }
    function abort() {
      finish(reject, signal.reason);
    }
    function fail() {
      finish(reject, new Error('Map worker failed'));
    }
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data: { result } }) => {
      if (signal.aborted) return;
      if (result.status === 'success') finish(resolve, result.data);
      else finish(reject, Object.assign(new Error(result.message), { isExpected: result.isExpected }));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      fail();
    };
    worker.onmessageerror = fail;
    try {
      worker.postMessage([{ url, params }]);
    } catch (error) {
      finish(reject, error);
    }
  });
}

export function startMapGridLoad(requests, set, {
  createWorker = () => new MapWorker(), baseUrl = document.baseURI, resources = gridResources, retry = false,
} = {}) {
  let stopped = false;
  const leases = requests.map(({ base, endpoint, params }) => {
    const path = `${base.replace(/\/$/, '')}/${endpoint}/`;
    const url = new URL(path, baseUrl);
    url.search = new URLSearchParams(params).toString();
    url.searchParams.sort();
    return resources.acquire(url.href, {
      timeoutMs: HEAVY_TIMEOUT_MS,
      retry,
      load: ({ signal }) => loadGrid({ url: url.href, params, createWorker, signal }),
    });
  });
  let results = leases.map(({ success: data }) => data === undefined ? loading : success(data));
  set(results);

  function cancel() {
    if (stopped) return;
    stopped = true;
    for (const lease of leases) lease.release();
  }

  leases.forEach((lease, index) => {
    function publish(data) {
      if (stopped || results[index].data === data) return;
      results = results.map((result, i) => i === index ? success(data) : result);
      set(results);
    }
    lease.subscribe(publish);
    lease.promise.then(publish, (error) => {
      if (stopped) return;
      const failure = { status: 'failed', message: error.message };
      if (error.isExpected !== undefined) failure.isExpected = error.isExpected;
      results = results.map((result) => result.status === 'loading' ? failure : result);
      set(results);
      cancel();
    });
  });
  return cancel;
}
