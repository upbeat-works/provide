import { derived, get, readonly, writable } from 'svelte/store';
import { createLatestRequest } from './request-state.js';
import { parseStoredScenarios, resolveScenarioSelection } from './scenario-selection.js';
import { DEFAULT_SCENARIOS_UID, LOCALSTORE_GEOGRAPHY, LOCALSTORE_PARAMETERS, LOCALSTORE_SCENARIOS, MAX_NUMBER_SELECTABLE_SCENARIOS } from '../config.js';
import { buildIndex } from '$lib/components/controls/GeographySelection/geography-tree.js';

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
      const geographyIndex = get(geographyIndexRequest.state);
      if (geographyIndex.status === 'success') applyGeographyIndex(geographyIndex.data);
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

  async function loadIndicatorIndex() {
    const geographyRevision = geographySelectionRevision;
    await indicatorIndexRequest.run();
    const state = get(indicatorIndexRequest.state);
    if (state.status === 'success') applyIndicatorIndex(state.data);
    const geographyIndex = get(geographyIndexRequest.state);
    if (geographyRevision === geographySelectionRevision && geographyIndex.status === 'success') applyGeographyIndex(geographyIndex.data);
  }

  function clearFilteredIndicators() {
    if (currentFilteredIndicatorInput === undefined) return;
    currentFilteredIndicatorInput = undefined;
    filteredIndicatorsRequest.clear();
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
    if (selectedIndicator && (indicatorIndex.status === 'idle' || indicatorIndex.status === 'loading')) return;
    if (selectedIndicator && indicatorIndex.status === 'success') {
      const selectedSourceFailed = instanceFailed(indicatorIndex.data, selectedIndicator.instance);
      const selectedIndicatorExists = (indicatorIndex.data.indicators ?? []).some((entry) => sameIndicator(entry, selectedIndicator));
      if (!selectedSourceFailed && selectedIndicatorExists) return;
    }
    pendingSelectionStore.update((value) => withoutKeys(value, ['geography']));
  }

  async function loadGeographyIndex() {
    const selectionRevision = geographySelectionRevision;
    await geographyIndexRequest.run();
    if (selectionRevision !== geographySelectionRevision) return;
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

    const parameters = resolveParameters(current.parameters, state.data);
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
    clearFilteredIndicators,
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
  defaultScenarios: DEFAULT_SCENARIOS_UID,
  storage: indicatorStorage,
});
