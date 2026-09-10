import { derived, get, readonly, writable } from 'svelte/store';
import { createLatestRequest } from './request-state.js';
import { resolveScenarioSelection } from './scenario-selection.js';

function joinUrl(base, path) {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

async function getJson(requestFetch, url) {
  const response = await requestFetch(url);
  if (response.ok) return response.json();

  let error = `Request failed with status ${response.status}`;
  try {
    const body = await response.json();
    if (typeof body?.error === 'string' && body.error) error = body.error;
  } catch {
    // The HTTP status remains useful when an upstream response is not JSON.
  }
  throw new Error(error);
}

function sameIndicator(left, right) {
  return left?.id === right?.id && left?.instance === right?.instance;
}

function normalizeIndicator(indicator) {
  if (typeof indicator?.id !== 'string' || !indicator.id.trim()) return undefined;
  if (typeof indicator.instance !== 'string' || !indicator.instance.trim()) return undefined;
  return { id: indicator.id, instance: indicator.instance };
}

function storedIndicator(storage, key) {
  if (!storage) return undefined;
  try {
    return normalizeIndicator(JSON.parse(storage.getItem(key)));
  } catch {
    return undefined;
  }
}

function sameParameters(left, right) {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  if (leftEntries.length !== rightEntries.length) return false;
  return leftEntries.every(([key, value]) => right[key] === value);
}

function instanceFailed(response, instance) {
  return (response.failedInstances ?? []).some((failure) => failure.instance === instance);
}

function withoutKeys(value, keys) {
  const next = { ...value };
  for (const key of keys) delete next[key];
  return next;
}

function indicatorQuery({ region, filters = {} } = {}) {
  const params = new URLSearchParams();
  if (region) params.set('region', region);
  for (const [key, values] of Object.entries(filters)) {
    if (values?.length) params.set(key, values.join(','));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

function indicatorDetailsPath(indicator) {
  return `indicator-details/${encodeURIComponent(indicator.id)}?instance=${encodeURIComponent(indicator.instance)}`;
}

function geographyAvailabilityPath(indicator) {
  const params = new URLSearchParams({ indicator: indicator.id, instance: indicator.instance });
  return `geography-availability?${params}`;
}

function scenarioAvailabilityPath({ indicator, geography, parameters, axis }) {
  const params = new URLSearchParams({
    indicator: indicator.id,
    region: geography,
    instance: indicator.instance,
  });
  for (const key of ['reference', 'time', 'spatial']) {
    if (parameters[key]) params.set(key, parameters[key]);
  }
  if (axis) params.set('axis', axis);
  return `scenario-availability?${params}`;
}

function scenarioDetailsPath(id, instance) {
  return `scenario-details/${encodeURIComponent(id)}?instance=${encodeURIComponent(instance)}`;
}

function scenarioAvailabilityResult(response, input) {
  return {
    ...response,
    context: {
      indicator: { ...input.indicator },
      geography: input.geography,
      parameters: { ...input.parameters },
    },
  };
}

function filteredIndicatorResult(response, input) {
  const filters = Object.fromEntries(Object.entries(input.filters).map(([key, values]) => [key, [...values]]));
  return {
    ...response,
    context: {
      region: input.region,
      filters,
    },
  };
}

function validParameters(current, details) {
  const parameters = new Map((details.parameters ?? []).map((parameter) => [parameter.id, parameter]));
  return Object.fromEntries(
    Object.entries(current).filter(([key, value]) => {
      const parameter = parameters.get(key);
      return parameter?.options?.some((option) => option.id === value);
    })
  );
}

export function reconcileConfirmedSelection({ current, allowed }) {
  if (Array.isArray(current)) return current.filter((value) => allowed.includes(value));
  if (allowed.includes(current)) return current;
  return undefined;
}

export function createRuntimeCatalog({ fetch: requestFetch, apiUrl = '/api', appUrl = '/app', defaultScenarios = [], storage, indicatorStorageKey = 'indicator' } = {}) {
  if (typeof requestFetch !== 'function') throw new TypeError('fetch is required');

  const initialIndicator = storedIndicator(storage, indicatorStorageKey);
  const initialPendingSelection = {};
  if (initialIndicator) {
    initialPendingSelection.indicator = initialIndicator.id;
    initialPendingSelection.instance = initialIndicator.instance;
  }
  const selectionStore = writable({
    indicator: initialIndicator,
    geography: undefined,
    parameters: {},
    scenarios: [],
  });
  const pendingSelectionStore = writable(initialPendingSelection);
  const indicatorFiltersStore = writable({});

  const indicatorIndexRequest = createLatestRequest(() => getJson(requestFetch, joinUrl(apiUrl, 'indicators')));
  const filterGroupsRequest = createLatestRequest(() => {
    const query = new URLSearchParams({ Sector: '' });
    return getJson(requestFetch, `${joinUrl(apiUrl, 'indicators')}?${query}`);
  });
  const filteredIndicatorsRequest = createLatestRequest(async (input) => {
    const response = await getJson(requestFetch, `${joinUrl(apiUrl, 'indicators')}${indicatorQuery(input)}`);
    return filteredIndicatorResult(response, input);
  });
  const geographyIndexRequest = createLatestRequest(async () => {
    const [geographies, geographyTypes] = await Promise.all([getJson(requestFetch, joinUrl(apiUrl, 'geographies')), getJson(requestFetch, joinUrl(apiUrl, 'geographies/types'))]);
    return { geographies, geographyTypes };
  });
  const geographyAvailabilityRequest = createLatestRequest((indicator) => getJson(requestFetch, joinUrl(apiUrl, geographyAvailabilityPath(indicator))));
  const indicatorDetailsRequest = createLatestRequest(async (indicator) => {
    const details = await getJson(requestFetch, joinUrl(appUrl, indicatorDetailsPath(indicator)));
    if (!sameIndicator(details, indicator)) {
      throw new Error('Indicator detail response does not match the request');
    }
    return details;
  });
  const percentileAvailabilityRequest = createLatestRequest(async (input) => {
    const response = await getJson(requestFetch, joinUrl(apiUrl, scenarioAvailabilityPath(input)));
    return scenarioAvailabilityResult(response, input);
  });
  const warmingLevelAvailabilityRequest = createLatestRequest(async (input) => {
    const response = await getJson(requestFetch, joinUrl(apiUrl, scenarioAvailabilityPath(input)));
    return scenarioAvailabilityResult(response, input);
  });
  const scenarioDetailsRequest = createLatestRequest(async ({ id, instance }) => {
    const details = await getJson(requestFetch, joinUrl(appUrl, scenarioDetailsPath(id, instance)));
    if (details.id !== id || details.instance !== instance) {
      throw new Error('Scenario detail response does not match the request');
    }
    return details;
  });

  let currentFilteredIndicatorInput;
  let currentGeographyAvailabilityInput;
  let currentIndicatorDetailsInput;
  let currentPercentileAvailabilityInput;
  let currentWarmingLevelAvailabilityInput;
  let indicatorSelectionRevision = 0;

  selectionStore.subscribe((selection) => {
    if (selection.indicator) {
      storage?.setItem(indicatorStorageKey, JSON.stringify(selection.indicator));
      return;
    }
    storage?.removeItem(indicatorStorageKey);
  });

  function clearScenarioAvailabilityRequests() {
    percentileAvailabilityRequest.clear();
    warmingLevelAvailabilityRequest.clear();
  }

  function clearAllSelectionDependentRequests() {
    geographyAvailabilityRequest.clear();
    indicatorDetailsRequest.clear();
    clearScenarioAvailabilityRequests();
    scenarioDetailsRequest.clear();
  }

  function setPendingSelection(pending) {
    indicatorSelectionRevision += 1;
    const normalized = {
      ...pending,
      parameters: { ...(pending.parameters ?? {}) },
      scenarios: [...(pending.scenarios ?? [])],
    };
    pendingSelectionStore.set(normalized);
    let selectedIndicator;
    if (normalized.indicator && normalized.instance) {
      selectedIndicator = { id: normalized.indicator, instance: normalized.instance };
    }
    selectionStore.set({
      indicator: selectedIndicator,
      geography: normalized.geography,
      parameters: normalized.parameters,
      scenarios: normalized.scenarios,
    });
    clearAllSelectionDependentRequests();
  }

  function selectIndicator(indicator) {
    const normalized = normalizeIndicator(indicator);
    if (typeof indicator !== 'undefined' && !normalized) return;
    indicatorSelectionRevision += 1;
    pendingSelectionStore.update((value) => withoutKeys(value, ['indicator', 'instance']));
    selectionStore.update((selection) => {
      if (sameIndicator(selection.indicator, normalized)) return selection;
      if (normalized) return { ...selection, indicator: normalized };
      return { ...selection, indicator: undefined, parameters: {}, scenarios: [] };
    });
    clearAllSelectionDependentRequests();
    if (!normalized) {
      const geographyIndex = get(geographyIndexRequest.state);
      if (geographyIndex.status === 'success') applyGeographyIndex(geographyIndex.data);
    }
  }

  function selectGeography(geography) {
    pendingSelectionStore.update((value) => withoutKeys(value, ['geography']));
    selectionStore.update((selection) => ({ ...selection, geography }));
    clearScenarioAvailabilityRequests();
  }

  function selectParameters(parameters) {
    pendingSelectionStore.update((value) => withoutKeys(value, ['parameters']));
    selectionStore.update((selection) => ({ ...selection, parameters: { ...parameters } }));
    clearScenarioAvailabilityRequests();
  }

  function selectScenarios(scenarios) {
    pendingSelectionStore.update((value) => withoutKeys(value, ['scenarios']));
    selectionStore.update((selection) => ({ ...selection, scenarios: [...scenarios] }));
    scenarioDetailsRequest.clear();
  }

  function applyIndicatorIndex(response) {
    const pending = get(pendingSelectionStore);
    if (!pending.indicator || !pending.instance) return;
    if (instanceFailed(response, pending.instance)) return;

    const match = (response.indicators ?? []).find((entry) => entry.id === pending.indicator && entry.instance === pending.instance);
    if (match) {
      selectionStore.update((selection) => ({
        ...selection,
        indicator: { id: match.id, instance: match.instance },
      }));
      pendingSelectionStore.update((value) => withoutKeys(value, ['indicator', 'instance']));
      return;
    }

    selectIndicator(undefined);
    pendingSelectionStore.update((value) => withoutKeys(value, ['indicator', 'instance', 'parameters', 'scenarios']));
  }

  async function loadIndicatorIndex() {
    await indicatorIndexRequest.run();
    const state = get(indicatorIndexRequest.state);
    if (state.status === 'success') applyIndicatorIndex(state.data);
    const geographyIndex = get(geographyIndexRequest.state);
    if (geographyIndex.status === 'success') applyGeographyIndex(geographyIndex.data);
  }

  async function loadFilteredIndicators({ region, filters } = {}) {
    const input = {
      region,
      filters: filters ?? get(indicatorFiltersStore),
    };
    const selectionRevision = indicatorSelectionRevision;
    currentFilteredIndicatorInput = input;
    await filteredIndicatorsRequest.run(input);
    if (currentFilteredIndicatorInput !== input) return;
    if (selectionRevision !== indicatorSelectionRevision) return;
    const state = get(filteredIndicatorsRequest.state);
    if (state.status !== 'success') return;

    const selection = get(selectionStore);
    if (!selection.indicator) return;
    if (input.region && input.region !== selection.geography) return;
    if (instanceFailed(state.data, selection.indicator.instance)) return;
    const allowed = (state.data.indicators ?? []).some((entry) => sameIndicator(entry, selection.indicator));
    if (!allowed) selectIndicator(undefined);
  }

  async function loadFilterGroups() {
    await filterGroupsRequest.run();
  }

  function applyGeographyIndex(response) {
    const pendingGeography = get(pendingSelectionStore).geography;
    if (!pendingGeography) return;
    const allowed = (response.geographies ?? []).map((geography) => geography.id);
    const geography = reconcileConfirmedSelection({ current: pendingGeography, allowed });
    if (geography !== pendingGeography) {
      selectGeography(geography);
      return;
    }
    const selectedIndicator = get(selectionStore).indicator;
    const indicatorIndex = get(indicatorIndexRequest.state);
    if (selectedIndicator && (indicatorIndex.status === 'idle' || indicatorIndex.status === 'loading')) return;
    if (selectedIndicator && indicatorIndex.status === 'success') {
      const selectedSourceFailed = instanceFailed(indicatorIndex.data, selectedIndicator.instance);
      const selectedIndicatorExists = (indicatorIndex.data.indicators ?? []).some((entry) => sameIndicator(entry, selectedIndicator));
      if (!selectedSourceFailed && selectedIndicatorExists) return;
    }
    pendingSelectionStore.update((value) => withoutKeys(value, ['geography']));
  }

  async function loadGeographyIndex() {
    await geographyIndexRequest.run();
    const state = get(geographyIndexRequest.state);
    if (state.status !== 'success') return;
    applyGeographyIndex(state.data);
  }

  async function loadGeographyAvailability() {
    const selection = get(selectionStore);
    if (!selection.indicator) {
      geographyAvailabilityRequest.clear();
      return;
    }
    const input = selection.indicator;
    currentGeographyAvailabilityInput = input;
    await geographyAvailabilityRequest.run(input);
    if (currentGeographyAvailabilityInput !== input) return;
    const state = get(geographyAvailabilityRequest.state);
    const current = get(selectionStore);
    if (state.status !== 'success' || !sameIndicator(current.indicator, input)) return;

    const geography = reconcileConfirmedSelection({
      current: current.geography,
      allowed: state.data.geographyIds ?? [],
    });
    if (geography !== current.geography) {
      selectGeography(geography);
      return;
    }
    pendingSelectionStore.update((value) => withoutKeys(value, ['geography']));
  }

  async function loadIndicatorDetails() {
    const selection = get(selectionStore);
    if (!selection.indicator) {
      indicatorDetailsRequest.clear();
      return;
    }
    const input = selection.indicator;
    currentIndicatorDetailsInput = input;
    await indicatorDetailsRequest.run(input);
    if (currentIndicatorDetailsInput !== input) return;
    const state = get(indicatorDetailsRequest.state);
    const current = get(selectionStore);
    if (state.status !== 'success' || !sameIndicator(current.indicator, input)) return;
    if (!sameIndicator(state.data, input)) return;

    const parameters = validParameters(current.parameters, state.data);
    if (!sameParameters(parameters, current.parameters)) {
      selectParameters(parameters);
      return;
    }
    pendingSelectionStore.update((value) => withoutKeys(value, ['parameters']));
  }

  function scenarioAvailabilityInput(axis) {
    const selection = get(selectionStore);
    if (!selection.indicator || !selection.geography) return undefined;
    return {
      indicator: selection.indicator,
      geography: selection.geography,
      parameters: { ...selection.parameters },
      axis,
    };
  }

  function matchesScenarioAvailabilityInput(input) {
    const current = get(selectionStore);
    if (!sameIndicator(current.indicator, input.indicator)) return false;
    if (current.geography !== input.geography) return false;
    return sameParameters(current.parameters, input.parameters);
  }

  async function loadPercentileAvailability() {
    const input = scenarioAvailabilityInput('percentile');
    if (!input) {
      percentileAvailabilityRequest.clear();
      return;
    }
    currentPercentileAvailabilityInput = input;
    await percentileAvailabilityRequest.run(input);
    if (currentPercentileAvailabilityInput !== input) return;
    const state = get(percentileAvailabilityRequest.state);
    if (state.status !== 'success' || !matchesScenarioAvailabilityInput(input)) return;
    const current = get(selectionStore);

    const next = resolveScenarioSelection({
      availability: { status: 'success', data: state.data.scenarios ?? [] },
      current: current.scenarios,
      defaults: defaultScenarios,
    });
    if (next !== null) selectScenarios(next);
    pendingSelectionStore.update((value) => withoutKeys(value, ['scenarios']));
  }

  async function loadWarmingLevelAvailability() {
    const input = scenarioAvailabilityInput('warmingLevel');
    if (!input) {
      warmingLevelAvailabilityRequest.clear();
      return;
    }
    currentWarmingLevelAvailabilityInput = input;
    await warmingLevelAvailabilityRequest.run(input);
    if (currentWarmingLevelAvailabilityInput !== input) return;
    if (!matchesScenarioAvailabilityInput(input)) warmingLevelAvailabilityRequest.clear();
  }

  async function loadScenarioDetails(id) {
    const selection = get(selectionStore);
    if (!selection.indicator || !id) {
      scenarioDetailsRequest.clear();
      return;
    }
    const input = { id, instance: selection.indicator.instance };
    await scenarioDetailsRequest.run(input);
  }

  return {
    selection: readonly(selectionStore),
    pendingSelection: readonly(pendingSelectionStore),
    selectedInstance: derived(selectionStore, ($selection) => $selection.indicator?.instance),
    indicatorIndex: indicatorIndexRequest.state,
    filteredIndicators: filteredIndicatorsRequest.state,
    filterGroups: filterGroupsRequest.state,
    geographyIndex: geographyIndexRequest.state,
    geographyAvailability: geographyAvailabilityRequest.state,
    indicatorDetails: indicatorDetailsRequest.state,
    percentileAvailability: percentileAvailabilityRequest.state,
    warmingLevelAvailability: warmingLevelAvailabilityRequest.state,
    scenarioDetails: scenarioDetailsRequest.state,
    indicatorFilters: indicatorFiltersStore,
    setPendingSelection,
    selectIndicator,
    selectGeography,
    selectParameters,
    selectScenarios,
    loadIndicatorIndex,
    loadFilteredIndicators,
    loadFilterGroups,
    loadGeographyIndex,
    loadGeographyAvailability,
    loadIndicatorDetails,
    loadPercentileAvailability,
    loadWarmingLevelAvailability,
    loadScenarioDetails,
  };
}

const indicatorStorage = typeof localStorage === 'undefined' ? undefined : localStorage;

export const runtimeCatalog = createRuntimeCatalog({
  fetch: (...args) => fetch(...args),
  apiUrl: import.meta.env.VITE_API_URL ?? '/api',
  storage: indicatorStorage,
});
