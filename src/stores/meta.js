import { page } from '$app/stores';
import { UID_STUDY_LOCATION_AVERAGE } from '$config';
import { unitLabels } from '$lib/utils/formatting';
import { buildIndex } from '$lib/components/controls/GeographySelection/geography-tree.js';
import { get, keyBy, sortBy } from 'lodash-es';
import { derived } from 'svelte/store';

// META DATA (This will only be set once on load and won't change again)
// Non-selectable types (continents) are grouping headers only — they must never
// appear as a selectable pill, so they are filtered out here.
export const GEOGRAPHY_TYPES = derived(page, ($page) =>
  sortBy(
    ($page.data?.geographies?.geographyTypes ?? [])
      .filter((t) => t.isSelectable !== false)
      .map((t) => ({ ...t, disabled: !t.isAvailable })),
    [
      (t) => t.disabled, // This sorts the available types first
      (t) => t.order,
      (t) => t.label,
    ]
  )
);

export const GEOGRAPHIES = derived(page, ($page) => {
  // Extract the geography types and its data from the geographies slice
  const { geographyTypes, ...byType } = $page.data?.geographies ?? {};
  if (geographyTypes?.length) {
    const geographies = geographyTypes.map(({ uid }) => {
      // Find the array of geographies for this geography type in the geographies slice
      const geographiesOfType = get(byType, uid, []).map((d) => ({
        ...d,
        geographyType: uid, // Add the geography type to each geography in the array
      }));
      return [uid, geographiesOfType]; // Return id and array to create object from it
    });
    return Object.fromEntries(geographies); // Create object of the geography types and geographies
  } else {
    return {};
  }
});

// Tree lookups (byId, childrenByParent, countriesByContinent) derived once from
// the flat per-type geography map. Continents flow through GEOGRAPHIES under the
// `continent` key, so country -> continent grouping resolves here even though
// continents are not a selectable type.
export const GEOGRAPHY_INDEX = derived(GEOGRAPHIES, ($geographies) => buildIndex($geographies));

export const SCENARIOS = derived(page, ($page) => {
  return $page.data?.catalog?.scenarios ?? [];
});

export const DICTIONARY_SCENARIOS = derived(SCENARIOS, ($scenarios) => keyBy($scenarios, 'uid'));


export const INDICATORS = derived(page, ($page) => {
  const catalog = $page.data?.catalog ?? {};
  const indicators = catalog.indicators ?? [];
  return indicators.map((indicator) => {
    // Scenario availability + geography filtering are no longer curated — they
    // come from ixmp4 (`/api/scenarios?indicator=&region=`, `/api/geographies?indicator=`).
    const labels = unitLabels[indicator.unit];
    const unit = {
      uid: indicator.unit,
      label: labels?.label ?? indicator.unit,
      labelLong: labels?.labelLong ?? indicator.unit,
    };
    return {
      ...indicator,
      unit,
    };
  });
});

export const DICTIONARY_INDICATORS = derived(INDICATORS, ($indicators) => keyBy($indicators, 'uid'));

export const INDICATOR_PARAMETERS = derived(page, ($page) => $page.data?.catalog?.indicatorParameters ?? []);
export const DICTIONARY_INDICATOR_PARAMETERS = derived(INDICATOR_PARAMETERS, ($parameters) => keyBy($parameters, 'uid'));

export const LIKELIHOODS = derived(page, ($page) => {
  return $page.data?.curation?.likelihoods ?? [];
});

export const STUDY_LOCATIONS = derived(page, ($page) => {
  const locations = sortBy(
    ($page.data?.curation?.studyLocations ?? []).map((location, i) => {
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
