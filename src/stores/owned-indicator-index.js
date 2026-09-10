import { derived, writable } from 'svelte/store';
import { createLatestRequest } from './request-state.js';

export function createOwnedIndicatorIndexRequest({ initialIndex, load }) {
  const currentIndex = writable(initialIndex);
  const latest = createLatestRequest(load);

  latest.state.subscribe((request) => {
    if (request.status === 'success') {
      currentIndex.set(request.data);
    }
  });

  const state = derived([latest.state, currentIndex], ([request, data]) => {
    if (request.status === 'idle') return { status: 'success', data };
    return { ...request, data };
  });

  function retry() {
    return latest.run();
  }

  return { state, retry };
}
