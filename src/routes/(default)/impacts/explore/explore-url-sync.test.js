import { describe, expect, test, vi } from 'vitest';
import { writable } from 'svelte/store';
import { markCatalogSelectionChange } from '$lib/catalog/selection-history.js';
import { parseCatalogUrlSelection } from '$lib/utils/url.js';
import { createExploreUrlSync } from './explore-url-sync.js';

function selectionFromUrl(url) {
  const parsed = parseCatalogUrlSelection(url);
  return {
    ...parsed,
    indicator: parsed.indicator ? { id: parsed.indicator, instance: parsed.instance } : undefined,
  };
}

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    async dispatch(type) {
      await listeners.get(type)?.();
    },
    has(type) {
      return listeners.has(type);
    },
  };
}

describe('Explore URL synchronization', () => {
  test('pushes user choices once, replaces automatic defaults, and restores Back and Forward', async () => {
    let currentUrl = new URL(
      'https://provide.example/impacts/explore?indicator=Heat&instance=source-a&geography=Algeria&scenarios%5B0%5D=Low%20Demand&context=methodology#impact-time'
    );
    const initialUrl = new URL(currentUrl);
    const selection = writable(selectionFromUrl(currentUrl));
    const pushes = [];
    const replacements = [];
    const restored = [];
    const events = eventTarget();
    const sync = createExploreUrlSync({
      selectionStore: selection,
      getUrl: () => new URL(currentUrl),
      getPageState: () => ({ retained: true }),
      push: (url, state) => {
        currentUrl = new URL(url);
        pushes.push({ url: new URL(url), state });
      },
      replace: (url, state) => {
        currentUrl = new URL(url);
        replacements.push({ url: new URL(url), state });
      },
      restore: async (url) => {
        restored.push(url.href);
        selection.set(selectionFromUrl(url));
        return true;
      },
      events,
    });
    sync.ready();
    expect(replacements).toHaveLength(0);

    markCatalogSelectionChange();
    selection.set({
      indicator: { id: 'Heat', instance: 'source-a' },
      geography: 'Afghanistan',
      scenarios: ['Low Demand'],
      parameters: {},
    });
    expect(pushes).toHaveLength(1);
    expect(pushes[0].state).toMatchObject({ retained: true });
    const forwardUrl = new URL(currentUrl);

    selection.update((value) => ({ ...value, parameters: { reference: '2011-2020 (Present Day)' } }));
    expect(pushes).toHaveLength(1);
    expect(replacements).toHaveLength(1);
    expect(parseCatalogUrlSelection(currentUrl).parameters.reference).toBe('2011-2020 (Present Day)');

    currentUrl = initialUrl;
    await events.dispatch('popstate');
    expect(restored.at(-1)).toBe(initialUrl.href);
    expect(pushes).toHaveLength(1);
    expect(replacements).toHaveLength(1);

    currentUrl = forwardUrl;
    await events.dispatch('popstate');
    expect(restored.at(-1)).toBe(forwardUrl.href);
    expect(pushes).toHaveLength(1);
    expect(replacements).toHaveLength(1);

    sync.destroy();
    expect(events.has('popstate')).toBe(false);
    markCatalogSelectionChange();
    selection.set({ ...selectionFromUrl(forwardUrl), geography: 'Portugal' });
    expect(pushes).toHaveLength(1);
  });

  test('keeps a user choice made during initial hydration and writes it when ready', () => {
    let currentUrl = new URL('https://provide.example/impacts/explore?context=methodology');
    const selection = writable({ parameters: {}, scenarios: [] });
    const push = vi.fn((url) => {
      currentUrl = new URL(url);
    });
    const events = eventTarget();
    const sync = createExploreUrlSync({
      selectionStore: selection,
      getUrl: () => new URL(currentUrl),
      getPageState: () => ({}),
      push,
      replace: vi.fn(),
      restore: vi.fn(async () => true),
      events,
    });

    markCatalogSelectionChange();
    selection.set({ indicator: { id: 'Heat', instance: 'source-a' }, geography: 'Algeria', scenarios: ['Low Demand'], parameters: {} });
    sync.ready();

    expect(push).toHaveBeenCalledTimes(1);
    expect(parseCatalogUrlSelection(currentUrl)).toMatchObject({ indicator: 'Heat', instance: 'source-a', geography: 'Algeria' });
    sync.destroy();
  });

  test('keeps a user choice made while Back restoration is still running', async () => {
    let currentUrl = new URL('https://provide.example/impacts/explore?geography=Algeria');
    const selection = writable({ geography: 'Algeria', parameters: {}, scenarios: [] });
    const pushes = [];
    const events = eventTarget();
    let finishRestore;
    const restoration = new Promise((resolve) => {
      finishRestore = resolve;
    });
    const sync = createExploreUrlSync({
      selectionStore: selection,
      getUrl: () => new URL(currentUrl),
      getPageState: () => ({}),
      push: (url) => {
        currentUrl = new URL(url);
        pushes.push(currentUrl.href);
      },
      replace: vi.fn(),
      restore: () => restoration,
      events,
    });
    sync.ready();

    const back = events.dispatch('popstate');
    markCatalogSelectionChange();
    selection.set({ geography: 'Afghanistan', parameters: {}, scenarios: [] });
    finishRestore(true);
    await back;

    expect(pushes).toHaveLength(1);
    expect(parseCatalogUrlSelection(currentUrl).geography).toBe('Afghanistan');
    sync.destroy();
  });
});
