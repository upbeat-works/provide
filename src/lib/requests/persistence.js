import { createStore, del, get, set } from 'idb-keyval';

const MAX_ENTRIES = 200;
const MAX_ENTRY_BYTES = 1024 * 1024;
const MAX_BYTES = 20 * MAX_ENTRY_BYTES;
const encoder = new TextEncoder();

export function browserPersistence() {
  if (typeof indexedDB === 'undefined') return;
  const store = createStore('provide-request-cache', 'public-json');
  const key = 'queries';
  return {
    persistClient: (snapshot) => set(key, snapshot, store),
    restoreClient: () => get(key, store),
    removeClient: () => del(key, store),
  };
}

export function limitSnapshot(snapshot, maxAge) {
  const now = Date.now();
  const timestamp = Number.isFinite(snapshot.timestamp) && snapshot.timestamp > 0 && snapshot.timestamp <= now
    ? snapshot.timestamp
    : 0;
  const entries = snapshot.clientState?.queries;
  const queries = Array.isArray(entries) ? entries.filter((query) => {
    const key = query?.queryKey;
    const updatedAt = query?.state?.dataUpdatedAt;
    return Array.isArray(key) && key.length === 1 && typeof key[0] === 'string'
      && query.queryHash === JSON.stringify(key)
      && query.state.data?.persistable === true
      && query.state.data.reusable === true
      && Object.hasOwn(query.state.data, 'data')
      && Number.isFinite(updatedAt) && updatedAt > 0 && updatedAt <= now && now - updatedAt < maxAge;
  }).sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt) : [];
  const result = { timestamp, buster: snapshot.buster, clientState: { mutations: [], queries: [] } };
  let bytes = encoder.encode(JSON.stringify(result)).byteLength;
  for (const query of queries) {
    if (result.clientState.queries.length >= MAX_ENTRIES) break;
    const entry = {
      queryHash: query.queryHash,
      queryKey: query.queryKey,
      state: {
        ...query.state,
        status: 'success',
        error: null,
        fetchStatus: 'idle',
        fetchFailureCount: 0,
        fetchFailureReason: null,
      },
    };
    const size = encoder.encode(JSON.stringify(entry)).byteLength;
    if (size > MAX_ENTRY_BYTES || bytes + size + 1 > MAX_BYTES) continue;
    result.clientState.queries.push(entry);
    bytes += size + 1;
  }
  return result;
}
