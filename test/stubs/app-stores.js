// `$app/stores` under vitest. SvelteKit's real implementation reads the stores
// out of the `__svelte__` context that the router sets, which is why a test
// fixture can stand in for the router by setting that context itself (several
// here do). This mirrors that, and falls back to inert defaults for a component
// rendered without one.
import { getContext, hasContext } from 'svelte';
import { readable } from 'svelte/store';

const fallback = {
  page: readable({
    url: new URL('http://localhost/'),
    params: {},
    route: { id: null },
    status: 200,
    error: null,
    data: {},
    form: undefined,
  }),
  navigating: readable(null),
  updated: readable(false),
};

export const getStores = () => (hasContext('__svelte__') ? getContext('__svelte__') : fallback);

// Subscribing lazily through `getStores` keeps these usable as module-level
// imports while still resolving against the context of the component using them.
export const page = { subscribe: (run) => getStores().page.subscribe(run) };
export const navigating = { subscribe: (run) => getStores().navigating.subscribe(run) };
export const updated = { subscribe: (run) => getStores().updated.subscribe(run), check: async () => false };
