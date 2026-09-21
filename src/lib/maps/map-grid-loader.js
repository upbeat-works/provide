import MapWorker from '../workers/impact-geo.js?worker';

export function startMapGridLoad(requests, set, { createWorker = () => new MapWorker(), baseUrl = document.baseURI } = {}) {
  let results = requests.map(() => ({ status: 'loading', data: null }));
  let worker;
  let stopped = false;
  set(results);

  function cancel() {
    if (stopped) return;
    stopped = true;
    worker?.terminate();
  }

  function fail(message) {
    if (stopped) return;
    results = results.map((result) => {
      if (result.status !== 'loading') return result;
      return { status: 'failed', message };
    });
    set(results);
    cancel();
  }

  if (requests.length) {
    try {
      worker = createWorker();
      worker.onmessage = ({ data: { index, result } }) => {
        if (stopped) return;
        results = results.map((current, i) => i === index ? result : current);
        if (result.status === 'failed') {
          results = results.map((current) => {
            if (current.status !== 'loading') return current;
            return { status: 'failed', message: result.message, isExpected: result.isExpected };
          });
        }
        set(results);
        if (results.every(({ status }) => status !== 'loading')) cancel();
      };
      worker.onerror = (event) => {
        event.preventDefault();
        fail('Map worker failed');
      };
      worker.onmessageerror = () => fail('Map worker failed');
      worker.postMessage(requests.map(({ base, endpoint, params }) => ({
        url: new URL(`${base.replace(/\/$/, '')}/${endpoint}/?${new URLSearchParams(params)}`, baseUrl).href,
        params,
      })));
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
  }
  return cancel;
}
