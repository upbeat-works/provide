import { requestResources } from '$lib/requests/index.js';
import { get } from 'svelte/store';

function isScenarioOnly(pending) {
  return pending.scenarios.length > 0 && !pending.indicator && !pending.geography && Object.keys(pending.parameters).length === 0;
}

function sameSelection(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameScenarioIntent(selection, pending) {
  if (selection.indicator) return false;
  if (JSON.stringify(selection.scenarios) !== JSON.stringify(pending.scenarios)) return false;
  return JSON.stringify(selection.parameters) === JSON.stringify(pending.parameters);
}

function inferredInstance(pending, indicatorIndex) {
  if (pending.instance) return pending.instance;
  if (indicatorIndex.status !== 'success') return undefined;
  const instances = [...new Set((indicatorIndex.data.indicators ?? []).map((indicator) => indicator.instance))];
  if (instances.length === 1) return instances[0];
  return undefined;
}

export async function initializeExplore({ pending, catalog, flow, requestFetch, apiUrl = '/api', signal, resources = requestResources, isCurrent = () => true }) {
  const hasPending = pending.indicator || pending.geography || pending.scenarios.length || Object.keys(pending.parameters).length;
  if (hasPending) flow.restoreSelection(pending);
  await flow.start();
  if (!isCurrent()) return { status: 'cancelled' };

  if (!isScenarioOnly(pending)) {
    const selection = get(catalog.selection);
    if (selection.indicator) await flow.chooseIndicator(selection.indicator);
    return { status: 'ready' };
  }

  if (!sameScenarioIntent(get(catalog.selection), pending)) return { status: 'cancelled' };
  const expectedSelection = get(catalog.selection);
  const instance = inferredInstance(pending, get(catalog.indicatorIndex));
  if (!instance) return { status: 'failure', message: 'A data source could not be chosen for these scenarios.' };

  const query = new URLSearchParams({ instance });
  for (const scenario of pending.scenarios) query.append('scenario', scenario);
  const compatibleDefaults = (defaults) => defaults?.indicator?.instance === instance
    && JSON.stringify(defaults.scenarios) === JSON.stringify(pending.scenarios);
  const lease = resources.acquire(`${apiUrl}/explore-defaults?${query}`, {
    fetch: requestFetch,
    signal,
    persist: true,
    cacheWhen: compatibleDefaults,
  });
  let defaults;
  try {
    defaults = await lease.promise;
  } catch (error) {
    lease.release();
    if (!isCurrent() || signal?.aborted) return { status: 'cancelled' };
    if (error.status === 404) return { status: 'failure', message: 'No compatible Explore selection was found.' };
    return { status: 'failure', message: 'Defaults could not be loaded.' };
  } finally {
    if (!signal) lease.release();
  }
  if (!isCurrent() || !sameSelection(get(catalog.selection), expectedSelection)) return { status: 'cancelled' };
  if (!compatibleDefaults(defaults)) {
    lease.release();
    return { status: 'failure', message: 'No compatible Explore selection was found.' };
  }

  const resolved = {
    indicator: defaults.indicator.id,
    instance: defaults.indicator.instance,
    geography: defaults.geography,
    parameters: defaults.parameters ?? {},
    scenarios: [...pending.scenarios],
  };
  flow.restoreSelection(resolved);
  await flow.chooseIndicator(defaults.indicator);
  return { status: 'ready' };
}
