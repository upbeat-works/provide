import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { api } from '../index';
import { instances } from '../instances';
import { createTestEnv } from '../test-helpers';

const instance = instances[0];

function setupFetchMock(captured?: { variablesBody?: unknown }) {
  return spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const req = new Request(input as RequestInfo, init);
    const url = new URL(req.url);

    if (req.method === 'POST' && url.href === `${instance.managerUrl}/token/obtain/`) {
      return new Response(JSON.stringify({ access: 'fake-token' }), { status: 200 });
    }

    if (req.method === 'PATCH' && url.href === `${instance.url}/iamc/variables/`) {
      if (captured) captured.variablesBody = await req.json();
      return new Response(JSON.stringify({
        results: [
          { id: 1, name: 'Investment|Adaptation|Labor Productivity' },
          { id: 2, name: 'Temperature|Global Mean' },
        ],
        total: 2,
      }), { status: 200 });
    }

    throw new Error(`Unexpected fetch: ${req.method} ${req.url}`);
  });
}

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;

beforeEach(() => {
  fetchSpy = setupFetchMock();
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('GET /api/indicators', () => {
  test('returns variables tagged with instance slug', async () => {
    const res = await api.request('/api/indicators', {}, createTestEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      indicators: [
        { id: 'Investment|Adaptation|Labor Productivity', instance: instance.slug },
        { id: 'Temperature|Global Mean', instance: instance.slug },
      ],
    });
  });

  test('forwards ?q= search as an ilike filter with * wildcards', async () => {
    fetchSpy.mockRestore();
    const captured: { variablesBody?: unknown } = {};
    fetchSpy = setupFetchMock(captured);
    await api.request('/api/indicators?q=investment', {}, createTestEnv());
    expect(captured.variablesBody).toEqual({ name__ilike: '*investment*' });
  });

  test('sends no name filter when ?q is absent', async () => {
    fetchSpy.mockRestore();
    const captured: { variablesBody?: unknown } = {};
    fetchSpy = setupFetchMock(captured);
    await api.request('/api/indicators', {}, createTestEnv());
    expect(captured.variablesBody).toEqual({});
  });
});
