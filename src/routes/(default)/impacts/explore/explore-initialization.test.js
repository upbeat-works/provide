import { describe, expect, test, vi } from 'vitest';
import { writable } from 'svelte/store';
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
  return { catalog, flow, requestFetch };
}

describe('Explore initialization', () => {
  test('resolves scenario-only links without using stored context', async () => {
    const pending = { instance: 'source-a', parameters: {}, scenarios: ['Low Demand'] };
    const context = setup({ pending });

    expect(await initializeExplore({ pending, ...context })).toEqual({ status: 'ready' });
    expect(context.requestFetch).toHaveBeenCalledWith('/api/explore-defaults?instance=source-a&scenario=Low+Demand');
    expect(context.flow.restoreSelection).toHaveBeenLastCalledWith({ indicator: 'Heat', instance: 'source-a', geography: 'Algeria', parameters: { time: 'Annual' }, scenarios: ['Low Demand'] });
    expect(context.flow.chooseIndicator).toHaveBeenCalledWith({ id: 'Heat', instance: 'source-a' });
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
