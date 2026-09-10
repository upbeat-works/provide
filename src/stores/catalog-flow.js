import { selectionUrlParams } from '$lib/catalog/selection-url.js';
import { runtimeCatalog } from './runtime-catalog.js';
import { indicatorFilterInput, indicatorFilterKey } from './catalog-adapters.js';
import { markCatalogSelectionChange } from '$lib/catalog/selection-history.js';

export { selectionUrlParams };

export function createCatalogFlow(catalog) {
  let activeIndicatorScopeKey;
  let activeIndicatorScopeRequest;

  async function loadScenarioAvailability() {
    await Promise.all([catalog.loadPercentileAvailability(), catalog.loadWarmingLevelAvailability()]);
  }

  async function start() {
    await Promise.all([catalog.loadIndicatorIndex(), catalog.loadFilterGroups(), catalog.loadGeographyIndex()]);
  }

  async function chooseGeography(id, options = {}) {
    if (options.history === 'push') markCatalogSelectionChange();
    catalog.selectGeography(id);
    await loadScenarioAvailability();
  }

  async function chooseIndicator(indicator, options = {}) {
    if (options.history === 'push') markCatalogSelectionChange();
    catalog.selectIndicator(indicator);
    await Promise.all([catalog.loadIndicatorDetails(), catalog.loadGeographyAvailability()]);
    await loadScenarioAvailability();
  }

  async function changeParameters(parameters, options = {}) {
    if (options.history === 'push') markCatalogSelectionChange();
    catalog.selectParameters(parameters);
    await loadScenarioAvailability();
  }

  function chooseScenarios(scenarios) {
    catalog.selectScenarios(scenarios);
  }

  async function openAdvancedFilters() {
    await catalog.loadFilterGroups();
  }

  async function applyFilters(filters, context) {
    catalog.indicatorFilters.set(filters);
    await syncIndicatorScope({ ...context, filters });
  }

  async function syncIndicatorScope(context) {
    const input = indicatorFilterInput(context);
    if (!input) return;
    const key = indicatorFilterKey(input);
    if (key === activeIndicatorScopeKey) return activeIndicatorScopeRequest;
    activeIndicatorScopeKey = key;
    activeIndicatorScopeRequest = catalog.loadFilteredIndicators(input);
    await activeIndicatorScopeRequest;
  }

  async function retryIndicatorScope(context) {
    activeIndicatorScopeKey = undefined;
    await syncIndicatorScope(context);
  }

  async function retryIndicatorDetails() {
    await catalog.loadIndicatorDetails();
  }

  async function retryPercentileAvailability() {
    await catalog.loadPercentileAvailability();
  }

  async function retryWarmingLevelAvailability() {
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
    openAdvancedFilters,
    applyFilters,
    syncIndicatorScope,
    retryIndicatorScope,
    retryIndicatorDetails,
    retryPercentileAvailability,
    retryWarmingLevelAvailability,
    loadScenarioDetails,
    catalog,
  };
}

export const catalogFlow = createCatalogFlow(runtimeCatalog);
