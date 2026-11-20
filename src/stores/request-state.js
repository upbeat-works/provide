import { readonly, writable } from 'svelte/store';

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
