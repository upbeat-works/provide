import { derived, get, readonly, writable } from 'svelte/store';
import { createCatalogRequest } from './request-state.js';
import { createRequestResources, requestResources } from '$lib/requests/index.js';
import { browser } from '$app/environment';
import { parseStoredScenarios, resolveScenarioSelection } from './scenario-selection.js';
import { DEFAULT_SCENARIOS_UID, LOCALSTORE_GEOGRAPHY, LOCALSTORE_PARAMETERS, LOCALSTORE_SCENARIOS, MAX_NUMBER_SELECTABLE_SCENARIOS } from '../config.js';
import { buildIndex } from '$lib/components/controls/GeographySelection/geography-tree.js';

function joinUrl(base, path) {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function sameIndicator(left, right) {
  return left?.id === right?.id && left?.instance === right?.instance;
}

function mergeIndicatorEntries(current, incoming) {
  const entries = new Map();
  for (const indicator of [...current, ...incoming]) {
    entries.set(JSON.stringify([indicator.instance, indicator.id]), indicator);
  }
  return [...entries.values()];
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

function storedValue(storage, key) {
  const value = storage?.getItem(key);
  return typeof value === 'string' && value ? value : undefined;
}

function storedParameters(storage, prefix) {
  const parameters = {};
  if (!storage) return parameters;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const value = storedValue(storage, key);
    if (value !== undefined) parameters[key.slice(prefix.length)] = value;
  }
  return parameters;
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

function firstSelectableGeography(response) {
  const types = (response.geographyTypes ?? [])
    .filter((type) => type.isSelectable !== false && type.isAvailable !== false)
    .sort((left, right) => {
      const order = (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER);
      if (order) return order;
      return (left.label ?? '').localeCompare(right.label ?? '');
    });
  const firstType = types[0]?.id;
  if (!firstType) return undefined;
  const candidates = (response.geographies ?? [])
    .filter((geography) => geography.geographyType === firstType)
    .map((geography) => ({ ...geography, uid: geography.id }));
  if (firstType === 'admin0') {
    const index = buildIndex({ admin0: candidates });
    const firstGroup = Object.entries(index.countriesByContinent).sort(([left], [right]) => left.localeCompare(right))[0];
    if (firstGroup) return firstGroup[1][0]?.uid;
  }
  candidates.sort((left, right) => (left.label ?? '').localeCompare(right.label ?? ''));
  return candidates[0]?.id;
}

function resolveParameters(current, details) {
  const values = {};
  for (const parameter of details.parameters ?? []) {
    const options = parameter.options ?? [];
    const selected = options.find((option) => option.id === current[parameter.id]);
    let fallback = options[0];
    if (parameter.id === 'reference') {
      fallback = options.find((option) => option.id === '2011-2020 (Present Day)') ?? fallback;
    }
    const value = selected ?? fallback;
    if (value) values[parameter.id] = value.id;
  }
  return values;
}

export function reconcileConfirmedSelection({ current, allowed }) {
  if (Array.isArray(current)) return current.filter((value) => allowed.includes(value));
  if (allowed.includes(current)) return current;
  return undefined;
}

export function createRuntimeCatalog({
  fetch: requestFetch,
  apiUrl = '/api',
  appUrl = '/app',
  defaultScenarios = [],
  storage,
  indicatorStorageKey = 'indicator',
  resources = createRequestResources({ fetch: requestFetch }),
} = {}) {
  if (typeof requestFetch !== 'function') throw new TypeError('fetch is required');

  const initialIndicator = storedIndicator(storage, indicatorStorageKey);
  const parameterStoragePrefix = `${LOCALSTORE_PARAMETERS}-`;
  const initialGeography = storedValue(storage, LOCALSTORE_GEOGRAPHY);
  const initialParameters = storedParameters(storage, parameterStoragePrefix);
  const initialScenarios = parseStoredScenarios(storage?.getItem(LOCALSTORE_SCENARIOS), defaultScenarios, MAX_NUMBER_SELECTABLE_SCENARIOS);
  const initialPendingSelection = {};
  if (initialIndicator) {
    initialPendingSelection.indicator = initialIndicator.id;
    initialPendingSelection.instance = initialIndicator.instance;
  }
  if (initialGeography) initialPendingSelection.geography = initialGeography;
  if (Object.keys(initialParameters).length) initialPendingSelection.parameters = initialParameters;
  if (initialScenarios.length) initialPendingSelection.scenarios = initialScenarios;
  const selectionStore = writable({
    indicator: initialIndicator,
    geography: initialGeography,
    parameters: initialParameters,
    scenarios: initialScenarios,
  });
  const pendingSelectionStore = writable(initialPendingSelection);
  const indicatorFiltersStore = writable({});
  const indicatorsStore = writable([]);
  const catalogRequest = (path, options = {}) => createCatalogRequest(resources, path, { fetch: requestFetch, persist: true, ...options });
  const api = (path) => joinUrl(apiUrl, path);
  const app = (path) => joinUrl(appUrl, path);
  const complete = (response) => !(response.failedInstances ?? []).length;
  const indicatorIndexRequest = catalogRequest(() => api('indicators'), {
    cacheWhen: complete,
    onRefresh: applyRefreshedIndicatorIndex,
  });
  const filterGroupsRequest = catalogRequest(({ region }) => api(`indicators/filters${indicatorQuery({ region })}`), {
    cacheWhen: complete,
    result: (response, { region }) => ({ ...response, context: { region } }),
  });
  const filteredIndicatorsRequest = catalogRequest((input) => api(`indicators${indicatorQuery(input)}`), {
    cacheWhen: complete,
    result: filteredIndicatorResult,
    onRefresh: applyFilteredIndicators,
  });
  let previousIndex;
  let refreshFilteredIndicators = false;
  indicatorIndexRequest.state.subscribe((request) => {
    if (request.status !== 'success' || previousIndex === request.data) return;
    refreshFilteredIndicators = previousIndex !== undefined;
    previousIndex = request.data;
    if (refreshFilteredIndicators && get(filteredIndicatorsRequest.state).status !== 'success') filteredIndicatorsRequest.clear();
    indicatorsStore.update((current) => mergeIndicatorEntries(
      current.filter((indicator) => instanceFailed(request.data, indicator.instance)),
      request.data.indicators ?? []
    ));
  });
  filteredIndicatorsRequest.state.subscribe((request) => {
    if (request.status !== 'success') return;
    indicatorsStore.update((current) => mergeIndicatorEntries(current, request.data.indicators ?? []));
  });
  const geographiesRequest = catalogRequest(() => api('geographies'), { onRefresh: applyRefreshedGeographyIndex });
  const geographyTypesRequest = catalogRequest(() => api('geographies/types'), { onRefresh: applyRefreshedGeographyIndex });
  const geographyIndexState = derived([geographiesRequest.state, geographyTypesRequest.state], ([geographies, geographyTypes]) => {
    if (geographies.status === 'failure') return geographies;
    if (geographyTypes.status === 'failure') return geographyTypes;
    if (geographies.status === 'success' && geographyTypes.status === 'success') {
      return { status: 'success', data: { geographies: geographies.data, geographyTypes: geographyTypes.data } };
    }
    if (geographies.status === 'idle' && geographyTypes.status === 'idle') return { status: 'idle' };
    return { status: 'loading' };
  });
  const geographyAvailabilityRequest = catalogRequest((indicator) => api(geographyAvailabilityPath(indicator)), {
    onRefresh: applyGeographyAvailability,
  });
  const indicatorDetailsRequest = catalogRequest((indicator) => app(indicatorDetailsPath(indicator)), {
    onRefresh: applyRefreshedIndicatorDetails,
    validate(details, indicator) {
      if (!sameIndicator(details, indicator)) throw new Error('Indicator detail response does not match the request');
    },
  });
  const availabilityRequest = (onRefresh) => catalogRequest((input) => api(scenarioAvailabilityPath(input)), {
    result: scenarioAvailabilityResult,
    onRefresh,
  });
  const percentileAvailabilityRequest = availabilityRequest(applyPercentileAvailability);
  const warmingLevelAvailabilityRequest = availabilityRequest();
  const scenarioDetailsCache = writable(new Map());
  const scenarioDetailsRequest = catalogRequest(({ id, instance }) => app(scenarioDetailsPath(id, instance)), {
    validate(details, { id, instance }) {
      if (details.id !== id || details.instance !== instance) throw new Error('Scenario detail response does not match the request');
    },
  });
  scenarioDetailsRequest.state.subscribe((request) => {
    if (request.status !== 'success') return;
    const { id, instance } = request.data;
    scenarioDetailsCache.update((cache) => new Map(cache).set(scenarioDetailsPath(id, instance), request.data));
  });

  let currentFilteredIndicatorInput;
  let filteredIndicatorSelectionRevision;
  let geographyIndexSelectionRevision;
  let currentGeographyAvailabilityInput;
  let currentIndicatorDetailsInput;
  let currentPercentileAvailabilityInput;
  let currentWarmingLevelAvailabilityInput;
  let indicatorSelectionRevision = 0;
  let geographySelectionRevision = 0;

  selectionStore.subscribe((selection) => {
    if (selection.indicator) {
      storage?.setItem(indicatorStorageKey, JSON.stringify(selection.indicator));
      return;
    }
    storage?.removeItem(indicatorStorageKey);
  });

  let storedParameterKeys = Object.keys(initialParameters);
  selectionStore.subscribe((selection) => {
    if (selection.geography) storage?.setItem(LOCALSTORE_GEOGRAPHY, selection.geography);
    else storage?.removeItem(LOCALSTORE_GEOGRAPHY);
    storage?.setItem(LOCALSTORE_SCENARIOS, JSON.stringify(selection.scenarios));
    for (const key of storedParameterKeys) {
      if (!(key in selection.parameters)) storage?.removeItem(`${parameterStoragePrefix}${key}`);
    }
    for (const [key, value] of Object.entries(selection.parameters)) storage?.setItem(`${parameterStoragePrefix}${key}`, value);
    storedParameterKeys = Object.keys(selection.parameters);
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
    geographySelectionRevision += 1;
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
      const geographyIndex = get(geographyIndexState);
      if (hasFreshGeographyIndex()) applyGeographyIndex(geographyIndex.data);
    }
  }

  function selectGeography(geography) {
    geographySelectionRevision += 1;
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

  function applyRefreshedIndicatorIndex(data) {
    applyIndicatorIndex(data);
    if (currentFilteredIndicatorInput) void loadFilteredIndicators(currentFilteredIndicatorInput);
  }

  async function loadIndicatorIndex({ refresh = false } = {}) {
    const geographyRevision = geographySelectionRevision;
    await indicatorIndexRequest.run(undefined, { retry: refresh });
    const state = get(indicatorIndexRequest.state);
    if (state.status === 'success') {
      if (indicatorIndexRequest.isFresh()) applyIndicatorIndex(state.data);
      if (currentFilteredIndicatorInput) await loadFilteredIndicators(currentFilteredIndicatorInput, { refresh });
    }
    const geographyIndex = get(geographyIndexState);
    if (geographyRevision === geographySelectionRevision && hasFreshGeographyIndex()) applyGeographyIndex(geographyIndex.data);
  }

  function clearFilteredIndicators() {
    if (currentFilteredIndicatorInput === undefined) return;
    currentFilteredIndicatorInput = undefined;
    filteredIndicatorsRequest.clear();
  }

  async function loadFilteredIndicators({ region, filters } = {}, { refresh = false } = {}) {
    const input = {
      region,
      filters: filters ?? get(indicatorFiltersStore),
    };
    const retry = refresh || refreshFilteredIndicators;
    refreshFilteredIndicators = false;
    filteredIndicatorSelectionRevision = indicatorSelectionRevision;
    currentFilteredIndicatorInput = input;
    await filteredIndicatorsRequest.run(input, { retry });
    const state = get(filteredIndicatorsRequest.state);
    if (filteredIndicatorsRequest.isFresh()) applyFilteredIndicators(state.data, input);
  }

  function applyFilteredIndicators(data, input) {
    if (currentFilteredIndicatorInput !== input || filteredIndicatorSelectionRevision !== indicatorSelectionRevision) return;

    const selection = get(selectionStore);
    if (!selection.indicator) return;
    if (input.region && input.region !== selection.geography) return;
    if (instanceFailed(data, selection.indicator.instance)) return;
    const allowed = (data.indicators ?? []).some((entry) => sameIndicator(entry, selection.indicator));
    if (!allowed) selectIndicator(undefined);
  }

  function loadFilterGroups({ region } = {}) {
    return filterGroupsRequest.run({ region });
  }

  function applyGeographyIndex(response) {
    const pendingGeography = get(pendingSelectionStore).geography;
    const selectableTypes = new Set(
      (response.geographyTypes ?? []).filter((type) => type.isSelectable !== false && type.isAvailable !== false).map((type) => type.id)
    );
    const allowed = (response.geographies ?? []).filter((geography) => selectableTypes.has(geography.geographyType)).map((geography) => geography.id);
    if (pendingGeography) {
      const geography = reconcileConfirmedSelection({ current: pendingGeography, allowed });
      if (geography !== pendingGeography) {
        selectGeography(firstSelectableGeography(response));
        return;
      }
    } else if (!allowed.includes(get(selectionStore).geography)) {
      const geography = firstSelectableGeography(response);
      selectGeography(geography);
    }
    const selectedIndicator = get(selectionStore).indicator;
    const indicatorIndex = get(indicatorIndexRequest.state);
    if (selectedIndicator && (indicatorIndex.status === 'idle' || indicatorIndex.status === 'loading'
        || (indicatorIndex.status === 'success' && !indicatorIndexRequest.isFresh()))) return;
    if (selectedIndicator && indicatorIndex.status === 'success') {
      const selectedSourceFailed = instanceFailed(indicatorIndex.data, selectedIndicator.instance);
      const selectedIndicatorExists = (indicatorIndex.data.indicators ?? []).some((entry) => sameIndicator(entry, selectedIndicator));
      if (!selectedSourceFailed && selectedIndicatorExists) return;
    }
    pendingSelectionStore.update((value) => withoutKeys(value, ['geography']));
  }

  function hasFreshGeographyIndex() {
    return geographiesRequest.isFresh() && geographyTypesRequest.isFresh();
  }

  function applyRefreshedGeographyIndex() {
    if (geographyIndexSelectionRevision !== geographySelectionRevision) return;
    const state = get(geographyIndexState);
    if (hasFreshGeographyIndex()) {
      applyGeographyIndex(state.data);
      geographyIndexSelectionRevision = geographySelectionRevision;
    }
  }

  async function loadGeographyIndex({ refresh = false } = {}) {
    const selectionRevision = geographySelectionRevision;
    geographyIndexSelectionRevision = selectionRevision;
    await Promise.all([geographiesRequest.run(undefined, { retry: refresh }), geographyTypesRequest.run(undefined, { retry: refresh })]);
    if (selectionRevision !== geographySelectionRevision) return;
    const state = get(geographyIndexState);
    if (!hasFreshGeographyIndex()) return;
    applyGeographyIndex(state.data);
    geographyIndexSelectionRevision = geographySelectionRevision;
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
    const state = get(geographyAvailabilityRequest.state);
    if (geographyAvailabilityRequest.isFresh()) applyGeographyAvailability(state.data, input);
  }

  function applyGeographyAvailability(data, input) {
    const current = get(selectionStore);
    if (currentGeographyAvailabilityInput !== input || !sameIndicator(current.indicator, input)) return;

    const geography = reconcileConfirmedSelection({
      current: current.geography,
      allowed: data.geographyIds ?? [],
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
    const state = get(indicatorDetailsRequest.state);
    if (indicatorDetailsRequest.isFresh()) applyIndicatorDetails(state.data, input);
  }

  function applyRefreshedIndicatorDetails(data, input) {
    const warmingWasRequested = get(warmingLevelAvailabilityRequest.state).status !== 'idle';
    if (applyIndicatorDetails(data, input)) {
      void loadPercentileAvailability();
      if (warmingWasRequested) void loadWarmingLevelAvailability();
    }
  }

  function applyIndicatorDetails(data, input) {
    const current = get(selectionStore);
    if (currentIndicatorDetailsInput !== input || !sameIndicator(current.indicator, input)) return;
    if (!sameIndicator(data, input)) return;
    const parameters = resolveParameters(current.parameters, data);
    if (!sameParameters(parameters, current.parameters)) {
      selectParameters(parameters);
      return true;
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
    const state = get(percentileAvailabilityRequest.state);
    if (percentileAvailabilityRequest.isFresh()) applyPercentileAvailability(state.data, input);
  }

  function applyPercentileAvailability(data, input) {
    if (currentPercentileAvailabilityInput !== input || !matchesScenarioAvailabilityInput(input)) return;
    const current = get(selectionStore);

    const next = resolveScenarioSelection({
      availability: { status: 'success', data: data.scenarios ?? [] },
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
      clearScenarioDetails();
      return;
    }
    const input = { id, instance: selection.indicator.instance };
    await scenarioDetailsRequest.run(input);
  }

  function clearScenarioDetails() {
    scenarioDetailsRequest.clear();
  }

  function clearFilterGroups() {
    filterGroupsRequest.clear();
  }

  function releaseRequests() {
    indicatorSelectionRevision += 1;
    geographySelectionRevision += 1;
    currentGeographyAvailabilityInput = undefined;
    currentIndicatorDetailsInput = undefined;
    currentPercentileAvailabilityInput = undefined;
    currentWarmingLevelAvailabilityInput = undefined;
    clearAllSelectionDependentRequests();
    clearFilteredIndicators();
    indicatorIndexRequest.clear();
    clearFilterGroups();
    scenarioDetailsCache.set(new Map());
    geographiesRequest.clear();
    geographyTypesRequest.clear();
  }

  return {
    releaseRequests,
    indicators: readonly(indicatorsStore),
    selection: readonly(selectionStore),
    pendingSelection: readonly(pendingSelectionStore),
    selectedInstance: derived(selectionStore, ($selection) => $selection.indicator?.instance),
    indicatorIndex: indicatorIndexRequest.state,
    filteredIndicators: filteredIndicatorsRequest.state,
    filterGroups: filterGroupsRequest.state,
    geographyIndex: geographyIndexState,
    geographyAvailability: geographyAvailabilityRequest.state,
    indicatorDetails: indicatorDetailsRequest.state,
    percentileAvailability: percentileAvailabilityRequest.state,
    warmingLevelAvailability: warmingLevelAvailabilityRequest.state,
    scenarioDetails: scenarioDetailsRequest.state,
    loadedScenarioDetails: readonly(scenarioDetailsCache),
    indicatorFilters: indicatorFiltersStore,
    setPendingSelection,
    selectIndicator,
    selectGeography,
    selectParameters,
    selectScenarios,
    loadIndicatorIndex,
    loadFilteredIndicators,
    clearFilteredIndicators,
    loadFilterGroups,
    clearFilterGroups,
    loadGeographyIndex,
    loadGeographyAvailability,
    loadIndicatorDetails,
    loadPercentileAvailability,
    loadWarmingLevelAvailability,
    loadScenarioDetails,
    clearScenarioDetails,
  };
}

const indicatorStorage = browser && typeof localStorage !== 'undefined' ? localStorage : undefined;

export const runtimeCatalog = createRuntimeCatalog({
  fetch: (...args) => fetch(...args),
  apiUrl: import.meta.env.VITE_API_URL ?? '/api',
  defaultScenarios: DEFAULT_SCENARIOS_UID,
  storage: indicatorStorage,
  resources: browser ? requestResources : undefined,
});
