import { selectionUrlParams } from '$lib/catalog/selection-url.js';
import { runtimeCatalog } from './runtime-catalog.js';
import { indicatorFilterInput, indicatorFilterKey } from './catalog-adapters.js';
import { markCatalogSelectionChange } from '$lib/catalog/selection-history.js';
import { MAX_NUMBER_SELECTABLE_SCENARIOS } from '$config';
import { ciGet, ciKeyBy } from '$lib/utils/case-insensitive.js';
import { get } from 'svelte/store';

export { selectionUrlParams };

export function createCatalogFlow(catalog) {
  let activeIndicatorScopeKey;
  let activeIndicatorScopeRequest;
  let warmingVisible = false;
  const selectionChecks = new Set();

  function canLoadWarming() {
    if (!warmingVisible || selectionChecks.size) return false;
    const selection = get(catalog.selection);
    const details = get(catalog.indicatorDetails);
    return selection.geography &&
      details.status === 'success' &&
      details.data.id === selection.indicator?.id &&
      details.data.instance === selection.indicator?.instance;
  }

  function loadWarmingWhenVisible() {
    if (canLoadWarming() && get(catalog.warmingLevelAvailability).status === 'idle') {
      void catalog.loadWarmingLevelAvailability();
    }
  }

  function setWarmingVisible(visible) {
    warmingVisible = visible;
    loadWarmingWhenVisible();
  }

  async function finishSelectionChange() {
    loadWarmingWhenVisible();
    await catalog.loadPercentileAvailability();
  }

  async function checkSelection(check) {
    const pending = Symbol();
    selectionChecks.add(pending);
    await check();
    return selectionChecks.delete(pending);
  }

  async function start() {
    await Promise.all([catalog.loadIndicatorIndex(), catalog.loadGeographyIndex()]);
  }

  async function chooseGeography(id, options = {}) {
    if (options.history === 'push') markCatalogSelectionChange();
    catalog.selectGeography(id);
    await finishSelectionChange();
  }

  async function chooseIndicator(indicator, options = {}) {
    if (options.history === 'push') markCatalogSelectionChange();
    selectionChecks.clear();
    catalog.selectIndicator(indicator);
    if (await checkSelection(() => Promise.all([catalog.loadIndicatorDetails(), catalog.loadGeographyAvailability()]))) {
      await finishSelectionChange();
    }
  }

  async function changeParameters(parameters, options = {}) {
    if (options.history === 'push') markCatalogSelectionChange();
    catalog.selectParameters(parameters);
    await finishSelectionChange();
  }

  function chooseScenarios(scenarios) {
    catalog.selectScenarios(scenarios);
  }

  function restoreSelection(selection) {
    selectionChecks.clear();
    catalog.setPendingSelection(selection);
  }

  function toggleScenario(id, { scenarios, timeframe } = {}) {
    const current = get(catalog.selection);
    const availableByUid = ciKeyBy((scenarios ?? []).filter((scenario) => !scenario.disabled));
    if (!ciGet(availableByUid, id)) return;
    const selected = current.scenarios.filter((uid) => ciGet(availableByUid, uid));
    if (!selected.length) {
      chooseScenarios([id]);
      return;
    }
    const selectedTimeframe = ciGet(availableByUid, selected[0])?.endYear;
    if (timeframe != null && selectedTimeframe !== timeframe) {
      chooseScenarios([id]);
      return;
    }
    let next = selected;
    if (selected.includes(id) && selected.length > 1) next = selected.filter((uid) => uid !== id);
    if (!selected.includes(id) && selected.length < MAX_NUMBER_SELECTABLE_SCENARIOS) next = [...selected, id];
    chooseScenarios([...next].sort());
  }

  async function openAdvancedFilters() {
    await catalog.loadFilterGroups();
  }

  async function applyFilters(filters, context) {
    catalog.indicatorFilters.set(filters);
    await syncIndicatorScope({ ...context, filters });
  }

  async function syncIndicatorScope(context, options = {}) {
    const input = indicatorFilterInput(context);
    if (!input) {
      activeIndicatorScopeKey = undefined;
      activeIndicatorScopeRequest = undefined;
      catalog.clearFilteredIndicators();
      return;
    }
    const key = indicatorFilterKey(input);
    if (key === activeIndicatorScopeKey) return activeIndicatorScopeRequest;
    activeIndicatorScopeKey = key;
    activeIndicatorScopeRequest = catalog.loadFilteredIndicators(input, options);
    await activeIndicatorScopeRequest;
  }

  async function retryIndicatorScope(context) {
    activeIndicatorScopeKey = undefined;
    await syncIndicatorScope(context, { refresh: true });
  }

  async function retryIndicatorDetails() {
    if (await checkSelection(catalog.loadIndicatorDetails)) await finishSelectionChange();
  }

  async function retryGeographyAvailability() {
    if (await checkSelection(catalog.loadGeographyAvailability)) loadWarmingWhenVisible();
  }

  async function retryPercentileAvailability() {
    await catalog.loadPercentileAvailability();
  }

  async function retryWarmingLevelAvailability() {
    if (!canLoadWarming() || get(catalog.warmingLevelAvailability).status !== 'failure') return;
    await catalog.loadWarmingLevelAvailability();
  }

  async function loadScenarioDetails(id) {
    await catalog.loadScenarioDetails(id);
  }

  return {
    start,
    chooseGeography,
    chooseIndicator,
    changeParameters,
    chooseScenarios,
    restoreSelection,
    toggleScenario,
    openAdvancedFilters,
    applyFilters,
    syncIndicatorScope,
    retryIndicatorScope,
    retryIndicatorDetails,
    retryGeographyAvailability,
    retryPercentileAvailability,
    retryWarmingLevelAvailability,
    setWarmingVisible,
    loadScenarioDetails,
    catalog,
  };
}

export const catalogFlow = createCatalogFlow(runtimeCatalog);
