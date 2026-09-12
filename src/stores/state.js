import { formatReadableList } from '$lib/utils/utils.js';
import { DEFAULT_FORMAT_UID, GEOGRAPHY_TYPES_IN_AVOIDING_IMPACTS, PATH_AVOID } from '$config';
import THEME from '$styles/theme-store.js';
import { get, keyBy, reduce } from 'lodash-es';
import { derived, writable } from 'svelte/store';
import { extractEndYearFromScenarios } from '$lib/utils/utils.js';
import { ciGet } from '$lib/utils/case-insensitive.js';
import { extractEndYear, extractStartYear } from '$utils/meta.js';
import { selectionUrlParams } from '$lib/catalog/selection-url.js';
import { legacyMapView } from '$lib/catalog/legacy-map-request.js';
import { colorScenarios } from '$lib/charts/scenarios.js';

import { FACETS_INITIAL, GEOGRAPHY_TYPES, INDICATORS, DICTIONARY_INDICATOR_PARAMETERS, DICTIONARY_SCENARIOS, GEOGRAPHIES, INDICATOR_PARAMETERS, SCENARIOS } from './meta.js';
import { activeFacetGroupCount } from './facet-selection.js';
import { graftScenarioAvailability } from './scenario-selection.js';
import { runtimeCatalog } from './runtime-catalog.js';
import {
  filteredIndicatorIds,
  indicatorListRequest,
  indicatorSelectionAvailable,
  parameterAdapter,
  percentileChartView,
  scenarioAvailabilityRows,
  warmingChartView,
} from './catalog-adapters.js';

export const RUNTIME_CATALOG_SELECTION = runtimeCatalog.selection;
export const PENDING_CATALOG_SELECTION = runtimeCatalog.pendingSelection;
export const SELECTED_INDICATOR_INSTANCE = runtimeCatalog.selectedInstance;
export const INDICATOR_INDEX_REQUEST = runtimeCatalog.indicatorIndex;
export const FILTER_GROUPS_REQUEST = runtimeCatalog.filterGroups;
export const FILTERED_INDICATORS_REQUEST = runtimeCatalog.filteredIndicators;
export const GEOGRAPHY_INDEX_REQUEST = runtimeCatalog.geographyIndex;
export const GEOGRAPHY_AVAILABILITY_REQUEST = runtimeCatalog.geographyAvailability;
export const INDICATOR_DETAILS_REQUEST = runtimeCatalog.indicatorDetails;
export const PERCENTILE_SCENARIO_AVAILABILITY_REQUEST = runtimeCatalog.percentileAvailability;
export const WARMING_LEVEL_SCENARIO_AVAILABILITY_REQUEST = runtimeCatalog.warmingLevelAvailability;
export const SCENARIO_DETAILS_REQUEST = runtimeCatalog.scenarioDetails;

// Optional CSS class(es) to override the header background, set per-page
export const HEADER_CLASS = writable('');

// Set to true if is in embed mode e.g. if the url is /embed/something
export const IS_EMBEDED = writable(false);

export const CURRENT_PAGE = writable('/');

export const IS_AVOID_PAGE = derived(CURRENT_PAGE, ($currentPage) => $currentPage === PATH_AVOID);

/*
 * SELECTION MODE
 * Controls whether the user is selecting geography-first or indicator-first.
 * 'geography' = geography-first (default), 'indicator' = indicator-first
 */
export const SELECTION_MODE = writable('geography');

/*
 * GEOGRAPHY STATE
 */

/**
 * Derived store that uses the list of geography types defined in the meta store and the current page to determine the list of available types
 * @type {Readable<Object[]>}
 */
export const AVAILABLE_GEOGRAPHY_TYPES = derived([GEOGRAPHY_TYPES, IS_AVOID_PAGE], ([$types, $isAvoidPage]) => {
  return $types.map((t) => {
    // It could be disabled by the meta endpoint
    const disabledByEndpoint = t.disabled;
    // By default no type is disabled
    let disabledByMode = false;
    // Check specifically for the avoid mode
    if ($isAvoidPage) {
      // Check if the type is present in the list of allowed types
      disabledByMode = !GEOGRAPHY_TYPES_IN_AVOIDING_IMPACTS.includes(t.uid);
    }
    let tooltip;
    if (disabledByEndpoint) {
      tooltip = 'Geography type is not available';
    } else if (disabledByMode) {
      tooltip = 'Switch to the Future impacts mode to see impact projections for this geography type';
    }
    return {
      ...t,
      disabled: disabledByEndpoint ? true : disabledByMode,
      tooltip,
    };
  });
});

/**
 * Derived store that filters the disabled geography types
 * @type {Readable<Object[]>}
 */
export const SELECTABLE_GEOGRAPHY_TYPES = derived(AVAILABLE_GEOGRAPHY_TYPES, ($types) => {
  return $types.filter(({ disabled }) => !disabled);
});

/** @type {Readable<string|undefined>} */
export const CURRENT_GEOGRAPHY_UID = derived(RUNTIME_CATALOG_SELECTION, ($selection) => $selection.geography);

/**
 * The geography object behind CURRENT_GEOGRAPHY_UID, or undefined while the id
 * is unset or the list hasn't loaded.
 * @type {Readable<Object|undefined>}
 */
export const CURRENT_GEOGRAPHY = derived([CURRENT_GEOGRAPHY_UID, SELECTABLE_GEOGRAPHY_TYPES, GEOGRAPHIES], ([$uid, $selectableGeographyTypes, $geographies]) => {
  if (typeof $uid === 'undefined') return undefined;
  for (const { uid: type } of $selectableGeographyTypes) {
    const geography = ($geographies[type] ?? []).find(({ uid }) => uid === $uid);
    if (geography) return geography;
  }
  return { uid: $uid, label: $uid };
});

export const CURRENT_GEOGRAPHY_LABEL = derived(CURRENT_GEOGRAPHY, ($geography) => {
  return $geography?.label;
});

/**
 * Derived store that checks if a geography is selected
 * @type {Readable<Boolean>}
 */
export const IS_EMPTY_GEOGRAPHY = derived(CURRENT_GEOGRAPHY_UID, ($uid) => {
  return !Boolean($uid);
});

/**
 * Derived store that holds the current geography type
 * @type {Readable<Object|undefined>}
 */
export const CURRENT_GEOGRAPHY_TYPE = derived([CURRENT_GEOGRAPHY, SELECTABLE_GEOGRAPHY_TYPES], ([$currentGeography, $geographyTypes]) => {
  if (typeof $currentGeography === 'undefined') {
    // This can happen for example if the user
    // - has a geography in localstorage and than visits the avoiding impacts page that does not have all geographies available.
    // - has selected an invalid geography through links
    return undefined;
  }
  const { geographyType: uid } = $currentGeography;
  if (typeof uid === 'undefined') {
    // If – for some reason – the geography has no geography type
    console.warn(`Could not determine geography type from current geography.`);
    return undefined;
  }
  const geographyType = $geographyTypes.find((type) => type.uid === uid);
  if (typeof geographyType === 'undefined') {
    // If the geography types do not include the current geography
    console.warn(`Could not find any geography type for uid ${uid}.`);
    return undefined;
  }
  return geographyType;
});

/*
 * INDICATOR STATE
 */

const byLabel = (a, b) => (a.label ?? '').localeCompare(b.label ?? '');

/**
 * Active advanced-filter selection: `{ [tagKey]: string[] }`. Empty means no
 * restriction.
 */
export const FACET_FILTERS = runtimeCatalog.indicatorFilters;

export const HAS_ACTIVE_FACET_FILTERS = derived(FACET_FILTERS, ($filters) => activeFacetGroupCount($filters) > 0);

export const FACET_SELECTION = derived(
  [FACETS_INITIAL, FACET_FILTERS, FILTERED_INDICATORS_REQUEST, CURRENT_GEOGRAPHY_UID, SELECTION_MODE, RUNTIME_CATALOG_SELECTION],
  ([$initial, $filters, $filtered, $geography, $mode, $selection], set) => {
    const filtersAreActive = activeFacetGroupCount($filters) > 0;
    const geographyNarrowsIndicators = $mode === 'geography' && Boolean($geography);
    if (!filtersAreActive && !geographyNarrowsIndicators) {
      set({ groups: $initial, indicatorIds: null });
      return;
    }
    if ($filtered.status === 'success') {
      set({
        groups: $filtered.data.filters ?? $initial,
        indicatorIds: filteredIndicatorIds({ request: $filtered, selection: $selection }),
      });
    }
  },
  { groups: [], indicatorIds: null }
);

export const FACET_GROUPS = derived(FACET_SELECTION, ($selection) => $selection.groups);

export const AVAILABLE_INDICATORS = derived(
  [INDICATORS, CURRENT_GEOGRAPHY_UID, SELECTION_MODE, FACET_SELECTION],
  ([$indicators, , , $facets]) => {
    const allowed = $facets.indicatorIds;
    if (!allowed) return [...$indicators].sort(byLabel);
    return $indicators.filter((indicator) => allowed.has(`${indicator.instance}\u0000${indicator.uid}`)).sort(byLabel);
  },
  []
);

export const ACTIVE_INDICATOR_SCOPE_CONTEXT = derived([FACET_FILTERS, CURRENT_GEOGRAPHY_UID, SELECTION_MODE], ([$filters, $geography, $mode]) => ({
  mode: $mode,
  geography: $geography,
  filters: $filters,
}));

export const ACTIVE_INDICATOR_SCOPE_REQUEST = derived([INDICATOR_INDEX_REQUEST, FILTERED_INDICATORS_REQUEST, ACTIVE_INDICATOR_SCOPE_CONTEXT], ([$index, $filtered, $context]) =>
  indicatorListRequest({
    ...$context,
    indexRequest: $index,
    filteredRequest: $filtered,
  })
);

export const CURRENT_INDICATOR_UID = derived(RUNTIME_CATALOG_SELECTION, ($selection) => $selection.indicator?.id);

export const AVAILABLE_GEOGRAPHIES_FOR_INDICATOR = derived(
  [CURRENT_INDICATOR_UID, GEOGRAPHIES, GEOGRAPHY_AVAILABILITY_REQUEST],
  ([$indicatorUid, $geographies, $availability]) => {
    if (!$indicatorUid || $availability.status !== 'success') return $geographies;
    const allowed = new Set($availability.data.geographyIds ?? []);
    return Object.fromEntries(Object.entries($geographies).map(([type, rows]) => [type, rows.filter((geography) => allowed.has(geography.uid))]));
  },
  {}
);

export const IS_EMPTY_INDICATOR = derived(CURRENT_INDICATOR_UID, ($uid) => {
  return !Boolean($uid);
});

export const IS_COMBINATION_AVAILABLE_INDICATOR = derived([RUNTIME_CATALOG_SELECTION, AVAILABLE_INDICATORS, ACTIVE_INDICATOR_SCOPE_REQUEST], ([$selection, $validIndicators, $request]) => {
  return indicatorSelectionAvailable({ selection: $selection, indicators: $validIndicators, request: $request });
});

export const CURRENT_INDICATOR = derived([RUNTIME_CATALOG_SELECTION, INDICATORS], ([$selection, $indicators]) => {
  const selected = $selection.indicator;
  if (!selected) return undefined;
  const indicator = $indicators.find((entry) => entry.uid === selected.id && entry.instance === selected.instance);
  if (indicator) return indicator;
  return {
    uid: selected.id,
    label: selected.id,
    instance: selected.instance,
    parameters: {},
    unit: { uid: DEFAULT_FORMAT_UID, label: DEFAULT_FORMAT_UID, labelLong: DEFAULT_FORMAT_UID },
  };
});

export const CURRENT_INDICATOR_UNIT = derived(CURRENT_INDICATOR, ($indicator) => get($indicator, ['unit']));

export const CURRENT_INDICATOR_UNIT_UID = derived(CURRENT_INDICATOR_UNIT, ($unit) => get($unit, 'uid', DEFAULT_FORMAT_UID));

export const CURRENT_INDICATOR_OPTION_VALUES = derived(RUNTIME_CATALOG_SELECTION, ($selection) => $selection.parameters);

export const CURRENT_INDICATOR_PARAMETERS = derived(
  [RUNTIME_CATALOG_SELECTION, INDICATOR_DETAILS_REQUEST, INDICATOR_PARAMETERS],
  ([$selection, $request, $definitions]) => parameterAdapter({ selection: $selection, request: $request, definitions: $definitions }),
  []
);

// Key value store of full parameter objects
export const CURRENT_INDICATOR_OPTIONS = derived([CURRENT_INDICATOR_OPTION_VALUES, DICTIONARY_INDICATOR_PARAMETERS], ([$currentOptions, $parameters]) => {
  return reduce(
    $currentOptions,
    (acc, uid, key) => {
      // A stale localStorage param key may not exist in the current parameter
      // dictionary (e.g. on the avoid page, which loads no ixmp4 catalog) — guard
      // so it resolves to undefined instead of throwing.
      acc[key] = $parameters[key]?.options?.find((option) => option.uid === uid);
      return acc;
    },
    {}
  );
});

export const CURRENT_INDICATOR_LABEL = derived([CURRENT_INDICATOR, CURRENT_INDICATOR_OPTIONS], ([$indicator, $options]) => {
  // This function is used to replace the X for example in 'nights a year with minimum temperatures above X°C'
  let labelWithinSentence = get($indicator, ['labelWithinSentence']); // This is the regular label we use
  let label = get($indicator, ['label']); // This is the regular label we use
  // Check if the current options hold an indicator value and if the indicator has the indicator value option
  if ($options.hasOwnProperty('indicator_value') && $indicator?.parameters?.indicator_value?.length) {
    // Check if there is a X°C in the label
    if (labelWithinSentence.match(/X°C/)) {
      // Replace the part with the label from the options
      labelWithinSentence = labelWithinSentence.replace(/X°C/, $options.indicator_value.label);
    }
    if (label.match(/X°C/)) {
      // Replace the part with the label from the options
      label = label.replace(/X°C/, $options.indicator_value.label);
    }
  }
  return {
    labelWithinSentence,
    label,
  };
});

// Utility for quicker access to list of indicator parameters
export const CURRENT_INDICATOR_PARAMETERS_KEYS = derived(CURRENT_INDICATOR_PARAMETERS, ($options) => {
  return $options.map((indicator) => get(indicator, 'uid'));
});

/*
 * SCENARIO STATE
 */

export const CURRENT_SCENARIOS_UID = derived(RUNTIME_CATALOG_SELECTION, ($selection) => $selection.scenarios);

export const CURRENT_SCENARIOS = derived([CURRENT_SCENARIOS_UID, DICTIONARY_SCENARIOS, THEME], ([$uids, $scenarios, $theme]) =>
  colorScenarios(($uids ?? []).map((uid) => ({
    uid,
    label: uid,
    ...ciGet($scenarios, uid),
  })), $theme.color.category)
);

export const DICTIONARY_CURRENT_SCENARIOS = derived([CURRENT_SCENARIOS], ([$currentScenarios]) => keyBy($currentScenarios, 'uid'));

export const SCENARIO_AVAILABILITY = derived(PERCENTILE_SCENARIO_AVAILABILITY_REQUEST, scenarioAvailabilityRows);
export const WARMING_LEVEL_AVAILABILITY = derived(WARMING_LEVEL_SCENARIO_AVAILABILITY_REQUEST, scenarioAvailabilityRows);

/**
 * Graft ixmp4 availability onto the catalog scenario list: each scenario carries
 * its data-driven `endYear` (timeframe) and a `disabled` flag when the axis has
 * no data for it. Availability is keyed by the raw ixmp4 scenario name, which may
 * differ in case from the catalog's canonical uid (the SSP5-3.4-OS/Os duplicate,
 * whose data is split across casings). Match case-insensitively so the scenario
 * isn't wrongly disabled and dropped.
 */
function createAvailableScenarios(availabilityStore) {
  return derived([SCENARIOS, availabilityStore], ([$SCENARIOS, $availability]) => graftScenarioAvailability($SCENARIOS, $availability));
}

export const AVAILABLE_SCENARIOS = createAvailableScenarios(SCENARIO_AVAILABILITY);

export const SELECTABLE_SCENARIOS = derived([AVAILABLE_SCENARIOS], ([$scenarios]) => {
  return $scenarios.filter(({ disabled }) => !disabled);
});

// Warming-level equivalents — the scenario universe the unavoidable-risk scatter
// plots (independent of the percentile-based ScenarioSelection on the same page).
export const AVAILABLE_WARMING_SCENARIOS = derived(WARMING_LEVEL_AVAILABILITY, ($availability) => $availability.map((scenario) => ({ ...scenario, disabled: false })));

export const SELECTABLE_WARMING_SCENARIOS = derived([AVAILABLE_WARMING_SCENARIOS], ([$scenarios]) => {
  return $scenarios.filter(({ disabled }) => !disabled);
});

export const SELECTABLE_SCENARIOS_UID = derived(SELECTABLE_SCENARIOS, ($scenarios) => $scenarios.map(({ uid }) => uid));

export const AVAILABLE_TIMEFRAMES = derived([AVAILABLE_SCENARIOS, SELECTABLE_SCENARIOS], ([$available, $selectable]) => {
  return extractEndYearFromScenarios($available ?? [], $selectable ?? []);
});

export const AVAILABLE_IMPACT_GEO_YEARS = derived([CURRENT_INDICATOR, CURRENT_SCENARIOS, CURRENT_INDICATOR_OPTIONS], ([$indicator, $scenarios, $options]) => {
  return get($indicator, 'selectableYears', [])
    .filter((year) => year <= extractEndYear($scenarios[0]) && year >= extractStartYear($scenarios[0]))
    .filter((year) => {
      // All years are available for non-absolute reference periods
      if ($options?.reference?.uid !== 'absolute') {
        return true;
      }

      // If the reference is absolute, the year 2020 is not available
      if ($options?.reference?.uid === 'absolute' && year === 2020) {
        return false;
      }
      // All other years are available for absolute reference periods
      return true;
    });
});

/* UTILITIES */
export const IS_EMPTY_SCENARIO = derived([CURRENT_SCENARIOS_UID, IS_AVOID_PAGE], ([$scenarios, $isAvoidPage]) => {
  if ($isAvoidPage) return false; // The Avoid page does not need any selected scenarios
  return !Array.isArray($scenarios) || !$scenarios.length;
});

export const IS_EMPTY_SELECTION = derived([IS_EMPTY_GEOGRAPHY, IS_EMPTY_INDICATOR, IS_EMPTY_SCENARIO], ([$geography, $indicator, $scenario]) => $geography || $indicator || $scenario);

export const IS_COMBINATION_AVAILABLE_SCENARIO = derived([IS_AVOID_PAGE, PERCENTILE_SCENARIO_AVAILABILITY_REQUEST, CURRENT_SCENARIOS_UID], ([$isAvoidPage, $availability, $current]) => {
  if ($isAvoidPage) return true;
  if (!Array.isArray($current) || !$current.length) return false;
  if ($availability.status !== 'success') return true;
  const selectable = new Set(($availability.data.scenarios ?? []).map((scenario) => scenario.id));
  return $current.every((uid) => selectable.has(uid));
});

// Charts require resolved geography and indicator objects as well as available
// IDs.
export const IS_COMBINATION_AVAILABLE = derived(
  [IS_COMBINATION_AVAILABLE_INDICATOR, IS_COMBINATION_AVAILABLE_SCENARIO, CURRENT_GEOGRAPHY, CURRENT_INDICATOR, INDICATOR_DETAILS_REQUEST, IS_AVOID_PAGE],
  ([$indicatorAvailable, $scenariosAvailable, $geography, $indicator, $details, $isAvoidPage]) => {
    const pairExists = Boolean($geography) && Boolean($indicator) && $indicatorAvailable && $scenariosAvailable;
    if (!pairExists || $isAvoidPage) return pairExists;
    return $details.status === 'success' && $details.data.id === $indicator.uid && $details.data.instance === $indicator.instance;
  }
);

export const WARMING_CHART_VIEW = derived(
  [IS_COMBINATION_AVAILABLE, WARMING_LEVEL_SCENARIO_AVAILABILITY_REQUEST, ACTIVE_INDICATOR_SCOPE_REQUEST, ACTIVE_INDICATOR_SCOPE_CONTEXT, RUNTIME_CATALOG_SELECTION],
  ([$combinationAvailable, $availability, $indicatorScopeRequest, $indicatorScopeContext, $selection]) =>
    warmingChartView({
      combinationAvailable: $combinationAvailable,
      availability: $availability,
      indicatorScopeRequest: $indicatorScopeRequest,
      indicatorScopeContext: $indicatorScopeContext,
      selection: $selection,
    })
);

export const MAP_CHART_VIEW = derived(
  [
    IS_COMBINATION_AVAILABLE,
    PERCENTILE_SCENARIO_AVAILABILITY_REQUEST,
    ACTIVE_INDICATOR_SCOPE_REQUEST,
    ACTIVE_INDICATOR_SCOPE_CONTEXT,
    RUNTIME_CATALOG_SELECTION,
    CURRENT_GEOGRAPHY,
    CURRENT_INDICATOR,
    CURRENT_SCENARIOS,
    CURRENT_INDICATOR_OPTION_VALUES,
  ],
  ([$combinationAvailable, $availability, $indicatorScopeRequest, $indicatorScopeContext, $selection, $geography, $indicator, $scenarios, $optionValues]) =>
    legacyMapView({
      chartView: percentileChartView({
        combinationAvailable: $combinationAvailable,
        availability: $availability,
        indicatorScopeRequest: $indicatorScopeRequest,
        indicatorScopeContext: $indicatorScopeContext,
        selection: $selection,
      }),
      geography: $geography,
      indicator: $indicator,
      scenarios: $scenarios,
      optionValues: $optionValues,
    })
);

export const TEMPLATE_PROPS = derived(
  [CURRENT_GEOGRAPHY, CURRENT_INDICATOR, CURRENT_SCENARIOS, CURRENT_INDICATOR_OPTIONS, CURRENT_INDICATOR_UNIT, CURRENT_INDICATOR_LABEL],
  ([$CURRENT_GEOGRAPHY, $CURRENT_INDICATOR, $CURRENT_SCENARIOS, $CURRENT_INDICATOR_OPTIONS, $CURRENT_INDICATOR_UNIT, $currentIndicatorLabel]) => {
    return {
      scenarioList: formatReadableList($CURRENT_SCENARIOS, 'label'),
      geography: $CURRENT_GEOGRAPHY,
      indicator: $CURRENT_INDICATOR,
      scenarios: $CURRENT_SCENARIOS,
      indicatorOptions: $CURRENT_INDICATOR_OPTIONS,
      indicatorUnit: $CURRENT_INDICATOR_UNIT,
      indicatorLabel: $currentIndicatorLabel,
    };
  }
);

// export const URL_CURRENT = derived([CURRENT_GEOGRAPHY_UID, CURRENT_INDICATOR_UID, CURRENT_INDICATOR_OPTION_VALUES], ([$CURRENT_GEOGRAPHY, $CURRENT_INDICATOR, $CURRENT_INDICATOR_OPTION_VALUES]) => {
//   return $CURRENT_INDICATOR; // buildURL('impacts', { indicator: $CURRENT_INDICATOR, geography: $CURRENT_GEOGRAPHY });
// });

// Object holding the parameters that are needed in every data download request
// scenario are not included since scenarios are specified as individual requests
export const DOWNLOAD_URL_PARAMS = derived(RUNTIME_CATALOG_SELECTION, ($selection) => {
  const { scenarios: _scenarios, ...params } = selectionUrlParams($selection);
  return params;
});
