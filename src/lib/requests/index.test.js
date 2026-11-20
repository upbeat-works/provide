import { describe, expect, it, vi } from 'vitest';
import { createRequestResources, requestJson } from './index.js';

const url = '/catalog?language=en';
const json = (value, init) => Response.json(value, init);
const hour = 60 * 60 * 1000;

function pendingFetch() {
  let finish;
  const fetch = vi.fn((_, { signal }) => new Promise((resolve, reject) => {
    finish = resolve;
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  return { fetch, finish: (value) => finish(json(value)) };
}

describe('requestJson', () => {
  it('rejects HTTP errors with the response detail and code', async () => {
    const fetch = async () => json({ message: 'Unavailable' }, { status: 503 });
    await expect(requestJson(url, { fetch })).rejects.toMatchObject({ message: 'Unavailable', status: 503 });
  });

  it('times out while reading the response body', async () => {
    const fetch = async () => new Response(new ReadableStream());
    await expect(requestJson(url, { fetch, timeoutMs: 1 })).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});

describe('request resources', () => {
  it('shares a request and aborts it only when the last consumer leaves', async () => {
    const { fetch, finish } = pendingFetch();
    const resources = createRequestResources({ fetch });
    const first = resources.acquire(url);
    const second = resources.acquire(url);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const signal = fetch.mock.calls[0][1].signal;
    first.release();
    expect(signal.aborted).toBe(false);
    finish(['catalog']);
    await expect(second.promise).resolves.toEqual(['catalog']);
    second.release();

    const third = resources.acquire(`${url}&page=2`);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    third.release();
    expect(fetch.mock.calls[1][1].signal.aborted).toBe(true);
    await expect(third.promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('serves recent data without a request and silently refreshes stale data', async () => {
    const now = vi.spyOn(Date, 'now');
    const stamp = now();
    try {
      const fetch = vi.fn().mockResolvedValueOnce(json('before')).mockResolvedValueOnce(json('after'));
      const resources = createRequestResources({ fetch });
      const first = resources.acquire(url);
      await expect(first.promise).resolves.toBe('before');
      first.release();
      const fresh = resources.acquire(url);
      expect(fresh.success).toBe('before');
      await expect(fresh.promise).resolves.toBe('before');
      fresh.release();
      expect(fetch).toHaveBeenCalledTimes(1);

      now.mockReturnValue(stamp + hour + 1000);
      const stale = resources.acquire(url);
      const update = vi.fn();
      stale.subscribe(update);
      await expect(stale.promise).resolves.toBe('before');
      await vi.waitFor(() => expect(update).toHaveBeenCalledWith('after', { updatedAt: expect.any(Number) }));
      stale.release();
    } finally {
      now.mockRestore();
    }
  });

  it('does not reuse partial responses or store POST responses', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json('partial')).mockResolvedValueOnce(json('complete'))
      .mockResolvedValueOnce(json('post one')).mockResolvedValueOnce(json('post two'));
    const resources = createRequestResources({ fetch });
    const partial = resources.acquire(url, { cacheWhen: (data) => data !== 'partial' });
    await expect(partial.promise).resolves.toBe('partial');
    partial.release();
    expect(resources.getCached(url)).toBeUndefined();
    const complete = resources.acquire(url);
    await expect(complete.promise).resolves.toBe('complete');
    complete.release();
    const post = resources.acquire(url, { method: 'POST', body: 'one' });
    const nextPost = resources.acquire(url, { method: 'POST', body: 'two' });
    await expect(post.promise).resolves.toBe('post one');
    await expect(nextPost.promise).resolves.toBe('post two');
    post.release();
    nextPost.release();
    expect(resources.getCached(url)).toBe('complete');
  });
});

describe('cache lifecycle', () => {
  it('deduplicates different parameter order while preserving repeated value order', async () => {
    const fetch = vi.fn().mockImplementation(async (url) => json(url));
    const resources = createRequestResources({ fetch });
    const first = resources.acquire('/catalog?b=x&a=1&a=2');
    const reordered = resources.acquire('/catalog?a=1&a=2&b=x');
    const different = resources.acquire('/catalog?a=2&a=1&b=x');
    await expect(reordered.promise).resolves.toBe('/catalog?b=x&a=1&a=2');
    await expect(different.promise).resolves.toBe('/catalog?a=2&a=1&b=x');
    expect(fetch).toHaveBeenCalledTimes(2);
    first.release();
    reordered.release();
    different.release();
  });

  it('serves a no-store response to consumers without reusing it', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json('first', { headers: { 'Cache-Control': 'no-store' } }))
      .mockResolvedValueOnce(json('second'));
    const resources = createRequestResources({ fetch });
    const first = resources.acquire(url);
    const update = vi.fn();
    first.subscribe(update);
    await expect(first.promise).resolves.toBe('first');
    expect(update).toHaveBeenCalledWith('first', { updatedAt: expect.any(Number) });
    expect(first.success).toBeUndefined();
    const second = resources.acquire(url);
    await expect(second.promise).resolves.toBe('second');
    expect(fetch).toHaveBeenCalledTimes(2);
    first.release();
    second.release();
  });

  it('replaces the same pending request on manual retry', async () => {
    const { fetch, finish } = pendingFetch();
    const resources = createRequestResources({ fetch });
    const initial = resources.acquire(url);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const retry = resources.acquire(url, { retry: true });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    finish('retried');
    await expect(retry.promise).resolves.toBe('retried');
    await expect(initial.promise).resolves.toBe('retried');
    initial.release();
    retry.release();
  });

  it('refreshes active stale entries on focus and online while keeping the last success on error', async () => {
    const now = vi.spyOn(Date, 'now');
    const stamp = now();
    const fetch = vi.fn()
      .mockResolvedValueOnce(json('before'))
      .mockResolvedValueOnce(json({ error: 'Temporary failure' }, { status: 503 }))
      .mockResolvedValueOnce(json('after'));
    const resources = createRequestResources({ fetch });
    const active = resources.acquire(url);
    const inactive = resources.acquire('/other');
    inactive.release();
    try {
      await expect(active.promise).resolves.toBe('before');
      const update = vi.fn();
      active.subscribe(update);
      now.mockReturnValue(stamp + hour + 1000);
      window.dispatchEvent(new Event('focus'));
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(resources.getCached(url)).toBe('before');
      expect(update).not.toHaveBeenCalled();
      window.dispatchEvent(new Event('online'));
      await vi.waitFor(() => expect(update).toHaveBeenCalledWith('after', { updatedAt: expect.any(Number) }));
      expect(fetch.mock.calls.map(([requestUrl]) => requestUrl)).toEqual([url, url, url]);
    } finally {
      active.release();
      now.mockRestore();
    }
  });
});

describe('persistent requests', () => {
  it('restores allowlisted responses and separately expires each success', async () => {
    let snapshot;
    const persistence = {
      persistClient: vi.fn((value) => { snapshot = value; }),
      restoreClient: () => snapshot,
      removeClient: () => { snapshot = undefined; },
    };
    const now = vi.spyOn(Date, 'now');
    const stamp = now();
    const fetch = vi.fn((url) => Promise.resolve(json(url, {
      headers: url === '/prohibited' ? { 'Cache-Control': 'no-store' } : {},
    })));
    const resources = createRequestResources({ fetch, persistence });
    async function load(url, options) {
      const lease = resources.acquire(url, options);
      try {
        await lease.promise;
      } finally {
        lease.release();
      }
    }
    try {
      now.mockReturnValue(stamp);
      await load('/old', { persist: true });
      now.mockReturnValue(stamp + 1000);
      await load('/current', { persist: true });
      await load('/prohibited', { persist: true });
      await load('/not-allowlisted');
      await load('/partial', { persist: true, cacheWhen: () => false });
      await vi.waitFor(() => expect(persistence.persistClient).toHaveBeenCalledTimes(1));

      now.mockReturnValue(stamp + 24 * hour + 1);
      const nextFetch = vi.fn().mockImplementation(async () => json('from network'));
      const reopened = createRequestResources({ fetch: nextFetch, persistence });
      const current = reopened.acquire('/current', { persist: true });
      await expect(current.promise).resolves.toBe('/current');
      current.release();
      expect(nextFetch.mock.calls.map(([url]) => url)).toEqual(['/current']);

      for (const url of ['/old', '/prohibited', '/not-allowlisted', '/partial']) {
        const missing = reopened.acquire(url, { persist: true });
        await expect(missing.promise).resolves.toBe('from network');
        missing.release();
      }
    } finally {
      now.mockRestore();
    }
  });

  it('continues to use memory if storage reads and writes fail', async () => {
    const unavailable = async () => { throw new Error('Storage unavailable'); };
    const persistence = { persistClient: vi.fn(unavailable), restoreClient: unavailable, removeClient: unavailable };
    const fetch = vi.fn(async () => json('data'));
    const resources = createRequestResources({ fetch, persistence });
    const first = resources.acquire(url, { persist: true });
    await expect(first.promise).resolves.toBe('data');
    first.release();
    await vi.waitFor(() => expect(persistence.persistClient).toHaveBeenCalledOnce());
    const second = resources.acquire(url, { persist: true });
    await expect(second.promise).resolves.toBe('data');
    second.release();
    expect(fetch).toHaveBeenCalledOnce();
  });
});

it('keeps recent inactive entries without evicting an active resource', async () => {
  const now = vi.spyOn(Date, 'now');
  let stamp = now();
  const fetch = vi.fn(async (url) => json(url));
  const resources = createRequestResources({ fetch, maxInactive: 2 });
  const active = resources.acquire('/active');
  try {
    await active.promise;
    for (const url of ['/one', '/two', '/three']) {
      now.mockReturnValue(++stamp);
      const lease = resources.acquire(url);
      await lease.promise;
      lease.release();
    }
    expect(resources.getCached('/active')).toBe('/active');
    expect(resources.getCached('/one')).toBeUndefined();
    expect(resources.getCached('/two')).toBe('/two');
    expect(resources.getCached('/three')).toBe('/three');
  } finally {
    active.release();
    now.mockRestore();
  }
});

it('does not reuse a partial HTTP response', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(json('part', { status: 206 })).mockResolvedValueOnce(json('full'));
  const resources = createRequestResources({ fetch });
  const part = resources.acquire(url);
  await expect(part.promise).resolves.toBe('part');
  part.release();
  const full = resources.acquire(url);
  await expect(full.promise).resolves.toBe('full');
  full.release();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('notifies consumers when an expired response is fetched again with the same JSON', async () => {
  const now = vi.spyOn(Date, 'now');
  const stamp = now();
  const fetch = vi.fn(async () => json({ name: 'same' }));
  const resources = createRequestResources({ fetch });
  now.mockReturnValue(stamp);
  const first = resources.acquire(url);
  await first.promise;
  first.release();
  now.mockReturnValue(stamp + 24 * hour);
  const next = resources.acquire(url);
  const update = vi.fn();
  next.subscribe(update);
  try {
    expect(next.success).toBeUndefined();
    await expect(next.promise).resolves.toEqual({ name: 'same' });
    expect(update).toHaveBeenCalledWith({ name: 'same' }, { updatedAt: expect.any(Number) });
  } finally {
    next.release();
    now.mockRestore();
  }
});

describe('incomplete content', () => {
  const incomplete = { headers: { 'Cache-Control': 'no-store', 'X-Content-Incomplete': 'true' } };

  it('keeps the last complete result when an attempted refresh returns incomplete content', async () => {
    const now = vi.spyOn(Date, 'now');
    const stamp = now();
    now.mockReturnValue(stamp);
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ id: 'Heat', description: 'CMS content' }))
      .mockResolvedValueOnce(json({ id: 'Heat' }, incomplete));
    const resources = createRequestResources({ fetch });
    const first = resources.acquire(url);
    await first.promise;
    first.release();
    now.mockReturnValue(stamp + hour);
    const retry = resources.acquire(url, { retry: true });
    try {
      await expect(retry.snapshot).resolves.toMatchObject({
        data: { id: 'Heat', description: 'CMS content' },
        updatedAt: stamp,
      });
      expect(resources.getCached(url)).toEqual({ id: 'Heat', description: 'CMS content' });
    } finally {
      retry.release();
      now.mockRestore();
    }
  });

  it('serves incomplete content on a cold request without keeping it for the next request', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ id: 'Heat' }, incomplete))
      .mockResolvedValueOnce(json({ id: 'Heat', description: 'CMS content' }));
    const resources = createRequestResources({ fetch });
    const cold = resources.acquire(url);
    const show = vi.fn();
    cold.subscribe(show);
    await expect(cold.snapshot).resolves.toMatchObject({ data: { id: 'Heat' }, incomplete: true });
    expect(show).toHaveBeenCalledWith({ id: 'Heat' }, { updatedAt: expect.any(Number), incomplete: true });
    expect(cold.success).toBeUndefined();
    cold.release();
    const next = resources.acquire(url);
    await expect(next.promise).resolves.toEqual({ id: 'Heat', description: 'CMS content' });
    next.release();
  });
});
