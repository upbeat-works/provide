<script>
  import { CURRENT_INDICATOR_OPTION_VALUES, IS_EMPTY_GEOGRAPHY, CURRENT_GEOGRAPHY, CURRENT_INDICATOR, IS_COMBINATION_AVAILABLE_INDICATOR, IS_EMPTY_INDICATOR } from '$stores/state.js';
  import { SELECTED_STUDY_LOCATION, LEVEL_OF_IMPACT } from '$stores/avoid.js';
  import { END_AVOIDING_REFERENCE, URL_PATH_GEOGRAPHY, URL_PATH_INDICATOR, URL_PATH_STUDY_LOCATION, STATUS_SUCCESS } from '$config';
  import { fetchData } from '$lib/api/api';
  import { formatUnit, formatValue } from '$lib/utils/formatting';
  import { writable } from 'svelte/store';
  import { round, floor, ceil, range } from 'lodash-es';
  import { mean } from 'd3-array';
  import Select from '$lib/controls/Select/Select.svelte';

  let store = writable({});

  $: unit = $CURRENT_INDICATOR?.unit;

  $: !$IS_EMPTY_GEOGRAPHY &&
    !$IS_EMPTY_INDICATOR &&
    $IS_COMBINATION_AVAILABLE_INDICATOR &&
    fetchData(store, {
      endpoint: END_AVOIDING_REFERENCE,
      params: {
        [URL_PATH_GEOGRAPHY]: $CURRENT_GEOGRAPHY.uid,
        [URL_PATH_INDICATOR]: $CURRENT_INDICATOR.uid,
        ...$CURRENT_INDICATOR_OPTION_VALUES,
        [URL_PATH_STUDY_LOCATION]: $SELECTED_STUDY_LOCATION,
      },
    });

  function getDecimalsOfNumber(n) {
    const parts = String(n).split('.');
    return parts.length === 2 ? parts[1].length : 0;
  }
  function floorNumber(v, offset, step, decimals) {
    return floor(Math.floor((v + offset) / step) * step, decimals);
  }
  function ceilNumber(v, offset, step, decimals) {
    return ceil(Math.floor((v + offset) / step) * step, decimals);
  }

  let options = [];
  let selectedValue;

  $: if ($store?.status === STATUS_SUCCESS) {
    const raw = $store.data;
    const step = raw.impact_levels.step;
    const decimals = getDecimalsOfNumber(step);
    const [min, max] = raw.impact_levels.range_of_interest;
    const [totalMin, totalMax] = raw.impact_levels.total;
    const offset = Math.min(0, totalMin) * -1;
    const tMin = floorNumber(totalMin, offset, step, decimals);
    const tMax = ceilNumber(totalMax, offset, step, decimals);
    const defaultValue = round(Math.round(mean([min + offset, max + offset]) / step) * step, decimals);

    options = range(tMin, tMax + step, step).map((v) => {
      const actual = round(v - offset, decimals);
      return {
        value: actual,
        label: `${formatValue(actual, unit?.uid, { decimals })}`,
      };
    });

    selectedValue = round(defaultValue - offset, decimals);
    LEVEL_OF_IMPACT.set(selectedValue);
  }
</script>

{#if options.length}
  <Select
    label="Level of Impact"
    {options}
    value={selectedValue}
    wrapperClass="flex-col border-r border-contour-weakest py-4"
    on:change={({ detail }) => {
      selectedValue = detail.value;
      LEVEL_OF_IMPACT.set(detail.value);
    }}
  />
{/if}
