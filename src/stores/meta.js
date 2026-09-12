import { page } from '$app/stores';
import { UID_STUDY_LOCATION_AVERAGE } from '$config';
import { unitLabels } from '$lib/utils/formatting';
import { buildIndex } from '$lib/components/controls/GeographySelection/geography-tree.js';
import { keyBy, sortBy } from 'lodash-es';
import { derived } from 'svelte/store';
import { ciKeyBy } from '$lib/utils/case-insensitive.js';
import { runtimeCatalog } from './runtime-catalog.js';

export const RUNTIME_INDICATORS = derived(
  runtimeCatalog.indicatorIndex,
  ($request, set) => {
    if ($request.status === 'idle') set([]);
    if ($request.status === 'success') set($request.data.indicators ?? []);
  },
  []
);

export const RUNTIME_FILTER_GROUPS = derived(
  runtimeCatalog.filterGroups,
  ($request, set) => {
    if ($request.status === 'idle') set([]);
    if ($request.status === 'success') set($request.data.filters ?? []);
  },
  []
);

export const RUNTIME_GEOGRAPHIES = derived(
  runtimeCatalog.geographyIndex,
  ($request, set) => {
    if ($request.status === 'idle') set({ geographies: [], geographyTypes: [] });
    if ($request.status === 'success') set($request.data);
  },
  { geographies: [], geographyTypes: [] }
);

export const RUNTIME_INDICATOR_PARAMETERS = derived(
  runtimeCatalog.indicatorDetails,
  ($request, set) => {
    if ($request.status === 'idle') set([]);
    if ($request.status === 'success') set($request.data.parameters ?? []);
  },
  []
);

export const GEOGRAPHY_TYPES = derived(RUNTIME_GEOGRAPHIES, ($runtime) =>
  sortBy(
    ($runtime.geographyTypes ?? [])
      .filter((type) => type.isSelectable !== false)
      .map((type) => ({
        ...type,
        uid: type.id,
        labelSingular: type.labelSingular ?? type.label,
        disabled: type.isAvailable === false,
      })),
    [(t) => t.disabled, (t) => t.order, (t) => t.label]
  )
);

export const GEOGRAPHIES = derived(RUNTIME_GEOGRAPHIES, ($runtime) => {
  const byType = {};
  for (const geography of $runtime.geographies ?? []) {
    const type = geography.geographyType;
    (byType[type] ??= []).push({
      ...geography,
      uid: geography.id,
      geoId: geography.geoId ?? geography.id,
    });
  }
  return byType;
});

export const GEOGRAPHY_INDEX = derived(GEOGRAPHIES, ($geographies) => buildIndex($geographies));

function scenarioGmt(details) {
  if (!details?.gmt) return undefined;
  return details.gmt.data.map(([minimum, value, maximum], index) => ({
    year: details.gmt.yearStart + details.gmt.yearStep * index,
    value,
    min: minimum,
    max: maximum,
  }));
}

export const SCENARIOS = derived(
  [runtimeCatalog.percentileAvailability, runtimeCatalog.scenarioDetails],
  ([$availability, $details], set) => {
    if ($availability.status !== 'success') return;
    const detail = $details.status === 'success' ? $details.data : undefined;
    set(
      ($availability.data.scenarios ?? []).map((scenario) => {
        const currentDetail = detail?.id === scenario.id ? detail : undefined;
        return {
          uid: scenario.id,
          label: currentDetail?.label ?? scenario.label,
          startYear: currentDetail?.yearStart ?? scenario.yearStart,
          yearStep: currentDetail?.yearStep,
          endYear: currentDetail?.yearEnd ?? scenario.yearEnd,
          description: currentDetail?.description,
          characteristics: currentDetail?.characteristics,
          gmt: scenarioGmt(currentDetail),
          instance: currentDetail?.instance,
        };
      })
    );
  },
  []
);

// Case-insensitive keys so a lookup by a differently-cased scenario uid (the
// SSP5-3.4-OS/Os source duplicate) still resolves. Read it with ciGet.
export const DICTIONARY_SCENARIOS = derived(SCENARIOS, ($scenarios) => ciKeyBy($scenarios));

export const INDICATORS = derived([RUNTIME_INDICATORS, runtimeCatalog.indicatorDetails], ([$indicators, $details]) => {
  const detail = $details.status === 'success' ? $details.data : undefined;
  return $indicators.map((indicator) => {
    const labels = unitLabels[indicator.unit];
    const unit = {
      uid: indicator.unit,
      label: labels?.label ?? indicator.unit,
      labelLong: labels?.labelLong ?? indicator.unit,
    };
    const currentDetail = detail?.id === indicator.id && detail.instance === indicator.instance ? detail : undefined;
    const parameters = Object.fromEntries((currentDetail?.parameters ?? []).map((parameter) => [parameter.id, parameter.options.map((option) => option.id)]));
    return {
      ...indicator,
      uid: indicator.id,
      unit,
      parameters,
      description: currentDetail?.description,
      models: currentDetail?.models ?? [],
      sources: currentDetail?.sources ?? [],
    };
  });
});

export const DICTIONARY_INDICATORS = derived(INDICATORS, ($indicators) => keyBy($indicators, 'uid'));

export const FACETS_INITIAL = RUNTIME_FILTER_GROUPS;

export const INDICATOR_PARAMETERS = derived(RUNTIME_INDICATOR_PARAMETERS, ($parameters) =>
  $parameters.map((parameter) => ({
    uid: parameter.id,
    label: parameter.label,
    options: parameter.options.map((option) => ({ uid: option.id, label: option.label })),
  }))
);
export const DICTIONARY_INDICATOR_PARAMETERS = derived(INDICATOR_PARAMETERS, ($parameters) => keyBy($parameters, 'uid'));

// On the avoid page these come from the frozen legacy /meta (avoidMeta); other
// surfaces (adaptation, methodology) still provide them via the curation slice.
export const LIKELIHOODS = derived(page, ($page) => {
  return $page.data?.avoidMeta?.likelihoods ?? $page.data?.curation?.likelihoods ?? [];
});

export const STUDY_LOCATIONS = derived(page, ($page) => {
  const locations = sortBy(
    ($page.data?.avoidMeta?.studyLocations ?? $page.data?.curation?.studyLocations ?? []).map((location, i) => {
      const isAverage = location.uid === UID_STUDY_LOCATION_AVERAGE;
      return {
        ...location,
        order: location.order ?? 9999 + i, // We use the assigned number or a very big one
        isAverage,
      };
    }),
    ['order']
  );
  // In order to number the values correctly (without the city average and starting from 1), we loop over the list and give each location a new order number
  let o = 1;
  return locations.map((location) => ({ ...location, order: location.uid === UID_STUDY_LOCATION_AVERAGE ? 0 : o++ }));
});
