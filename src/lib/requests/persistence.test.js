import { expect, it } from 'vitest';
import { limitSnapshot } from './persistence.js';

const MiB = 1024 * 1024;
const age = 24 * 60 * 60 * 1000;

function makeSnapshot(count, data) {
  const timestamp = Date.now();
  return {
    timestamp,
    buster: 'public-json-v1',
    clientState: {
      mutations: [],
      queries: Array.from({ length: count }, (_, index) => ({
        queryKey: ['/catalog?page=' + index],
        queryHash: JSON.stringify(['/catalog?page=' + index]),
        state: { data: { data, persistable: true, reusable: true }, dataUpdatedAt: timestamp - count + index },
      })),
    },
  };
}

it('keeps the newest 200 eligible responses', () => {
  const saved = limitSnapshot(makeSnapshot(205, 'data'), age);
  expect(saved.clientState.queries).toHaveLength(200);
  expect(saved.clientState.queries.map((entry) => entry.queryKey[0])).toEqual(
    Array.from({ length: 200 }, (_, index) => '/catalog?page=' + (204 - index)),
  );
});

it('enforces per-entry and total byte limits using UTF-8 size', () => {
  const snapshot = makeSnapshot(25, 'é'.repeat(500_000));
  const tooLarge = snapshot.clientState.queries.at(-1);
  tooLarge.state.data.data = 'é'.repeat(550_000);

  const saved = limitSnapshot(snapshot, age);
  expect(saved.clientState.queries).toHaveLength(20);
  expect(saved.clientState.queries[0].queryKey).toEqual(['/catalog?page=23']);
  expect(new TextEncoder().encode(JSON.stringify(saved)).byteLength).toBeLessThan(20 * MiB);
});

it('discards malformed entries and future success timestamps', () => {
  const snapshot = makeSnapshot(4, 'data');
  snapshot.clientState.queries[3].state.dataUpdatedAt = snapshot.timestamp + 60_000;
  snapshot.clientState.queries[2].queryHash = 'wrong';
  snapshot.clientState.queries[1] = null;
  const saved = limitSnapshot(snapshot, age);
  expect(saved.clientState.queries.map(({ queryKey }) => queryKey)).toEqual([['/catalog?page=0']]);
});
