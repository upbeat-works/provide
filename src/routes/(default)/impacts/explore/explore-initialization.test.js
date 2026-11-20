import { describe, expect, test, vi } from 'vitest';
import { writable } from 'svelte/store';
import { createRequestResources } from '$lib/requests/index.js';
import { initializeExplore } from './explore-initialization.js';

function setup({ pending, instances = ['source-a'], response } = {}) {
  const selection = writable({ indicator: undefined, geography: undefined, parameters: {}, scenarios: [] });
  const indicatorIndex = writable({ status: 'success', data: { indicators: instances.map((instance) => ({ id: 'Heat', instance })) } });
  const catalog = {
    selection,
    indicatorIndex,
  };
  const restoreSelection = vi.fn((value) =>
      selection.set({
        indicator: value.indicator ? { id: value.indicator, instance: value.instance } : undefined,
        geography: value.geography,
        parameters: value.parameters ?? {},
        scenarios: value.scenarios ?? [],
      })
    );
  const flow = { start: vi.fn(async () => {}), chooseIndicator: vi.fn(async () => {}), restoreSelection };
  const requestFetch = vi.fn(async () =>
    Response.json(response ?? { indicator: { id: 'Heat', instance: 'source-a' }, geography: 'Algeria', parameters: { time: 'Annual' }, scenarios: pending.scenarios })
  );
  return { catalog, flow, requestFetch, resources: createRequestResources() };
}

describe('Explore initialization', () => {
  test('resolves scenario-only links without using stored context', async () => {
    const pending = { instance: 'source-a', parameters: {}, scenarios: ['Low Demand'] };
    const context = setup({ pending });

    expect(await initializeExplore({ pending, ...context })).toEqual({ status: 'ready' });
    expect(context.requestFetch).toHaveBeenCalledWith('/api/explore-defaults?instance=source-a&scenario=Low+Demand', { signal: expect.any(AbortSignal) });
    expect(context.flow.restoreSelection).toHaveBeenLastCalledWith({ indicator: 'Heat', instance: 'source-a', geography: 'Algeria', parameters: { time: 'Annual' }, scenarios: ['Low Demand'] });
    expect(context.flow.chooseIndicator).toHaveBeenCalledWith({ id: 'Heat', instance: 'source-a' });
  });

  test('keeps refreshing stale defaults after choosing the cached selection', async () => {
    const pending = { instance: 'source-a', parameters: {}, scenarios: ['Low Demand'] };
    const context = setup({ pending });
    const url = '/api/explore-defaults?instance=source-a&scenario=Low+Demand';
    let now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    const controller = new AbortController();
    try {
      expect(await initializeExplore({ pending, ...context })).toEqual({ status: 'ready' });
      now += 3600_001;
      const next = { ...context.resources.getCached(url), geography: 'Portugal' };
      let finishRefresh;
      context.requestFetch.mockImplementationOnce((_path, { signal }) => new Promise((resolve) => {
        signal.addEventListener('abort', () => resolve(Response.json({}, { status: 503 })), { once: true });
        finishRefresh = () => resolve(Response.json(next));
      }));

      expect(await initializeExplore({ pending, ...context, signal: controller.signal })).toEqual({ status: 'ready' });
      expect(context.flow.restoreSelection).toHaveBeenLastCalledWith(expect.objectContaining({ geography: 'Algeria' }));
      await vi.waitFor(() => expect(finishRefresh).toBeTypeOf('function'));
      expect(context.requestFetch.mock.calls.at(-1)[1].signal.aborted).toBe(false);
      finishRefresh();
      await vi.waitFor(() => expect(context.resources.getCached(url)).toEqual(next));
      expect(context.flow.restoreSelection).toHaveBeenLastCalledWith(expect.objectContaining({ geography: 'Algeria' }));
    } finally {
      controller.abort();
      clock.mockRestore();
    }
  });

  test('does not request defaults for an explicit selection', async () => {
    const pending = { indicator: 'Heat', instance: 'source-a', geography: 'Algeria', parameters: {}, scenarios: ['Low Demand'] };
    const context = setup({ pending });

    await initializeExplore({ pending, ...context });

    expect(context.requestFetch).not.toHaveBeenCalled();
  });

  test('does not guess between multiple scenario sources', async () => {
    const pending = { parameters: {}, scenarios: ['Low Demand'] };
    const context = setup({ pending, instances: ['source-a', 'source-b'] });

    expect(await initializeExplore({ pending, ...context })).toMatchObject({ status: 'failure' });
    expect(context.requestFetch).not.toHaveBeenCalled();
  });

  test('allows the geography index to apply its automatic geography', async () => {
    const pending = { instance: 'source-a', parameters: {}, scenarios: ['Low Demand'] };
    const context = setup({ pending });
    context.flow.start = async () => context.catalog.selection.set({ indicator: undefined, geography: 'Automatic geography', parameters: {}, scenarios: ['Low Demand'] });

    expect(await initializeExplore({ pending, ...context })).toEqual({ status: 'ready' });
    expect(context.requestFetch).toHaveBeenCalledOnce();
  });

  test('ignores defaults if the user changes selection while indexes load', async () => {
    const pending = { instance: 'source-a', parameters: {}, scenarios: ['Low Demand'] };
    const context = setup({ pending });
    context.flow.start = async () => context.catalog.selection.set({ indicator: { id: 'User choice', instance: 'source-a' }, geography: 'Spain', parameters: {}, scenarios: [] });

    expect(await initializeExplore({ pending, ...context })).toEqual({ status: 'cancelled' });
    expect(context.requestFetch).not.toHaveBeenCalled();
  });
});
