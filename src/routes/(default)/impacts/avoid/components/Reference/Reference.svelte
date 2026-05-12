<script>
  import { CURRENT_INDICATOR_OPTION_VALUES, IS_EMPTY_GEOGRAPHY, CURRENT_GEOGRAPHY, CURRENT_INDICATOR, TEMPLATE_PROPS, IS_COMBINATION_AVAILABLE_INDICATOR, IS_EMPTY_INDICATOR } from '$stores/state.js';
  import { SELECTED_STUDY_LOCATION, REFERENCE_PROCESSED, LEVEL_OF_IMPACT } from '$stores/avoid.js';
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import { END_AVOIDING_REFERENCE, URL_PATH_GEOGRAPHY, URL_PATH_INDICATOR, URL_PATH_STUDY_LOCATION } from '$config';
  import { fetchData } from '$lib/api/api';
  import ImpactLevel from './ImpactLevel.svelte';
  import { mean } from 'd3-array';
  import { round, floor, ceil } from 'lodash-es';
  import { writable } from 'svelte/store';
  import { Popover, PopoverButton, PopoverPanel } from '@rgossiaux/svelte-headlessui';
  import { createPopperActions } from 'svelte-popperjs';
  import ExpandIcon from '$lib/components/icons/Expand.svelte';
  import { formatValue, formatUnit } from '$lib/utils/formatting';

  const store = writable({});

  let _lastProcessedDefault = null;

  const [popperRef, popperContent] = createPopperActions();
  const popperOptions = {
    placement: 'bottom-start',
    strategy: 'fixed',
    modifiers: [{ name: 'offset', options: { offset: [0, 10] } }],
  };

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

  $: process = ({ data }) => {
    const countable = data.data.countable;
    const step = data.data.impact_levels.step;
    const average_value = data.data.average_value;
    const decimals = getDecimalsOfNumber(step);
    const [min, max] = data.data.impact_levels.range_of_interest;
    const [totalMin, totalMax] = data.data.impact_levels.total;
    const offset = Math.min(0, totalMin) * -1;
    const defaultValue = round(Math.round(mean([min + offset, max + offset]) / step) * step, decimals);
    const processed = {
      step,
      min: floorNumber(min, offset, step, decimals),
      max: ceilNumber(max, offset, step, decimals),
      totalMin: floorNumber(totalMin, offset, step, decimals),
      totalMax: ceilNumber(totalMax, offset, step, decimals),
      defaultValue,
      offset,
      average_value,
      decimals,
      countable,
    };
    REFERENCE_PROCESSED.set(processed);
    const newLevelDefault = round(defaultValue - offset, decimals);
    if (newLevelDefault !== _lastProcessedDefault) {
      LEVEL_OF_IMPACT.set(newLevelDefault);
      _lastProcessedDefault = newLevelDefault;
    }
    return { data: processed };
  };

  $: $store?.data && process({ data: $store });

  $: ({ unit } = $CURRENT_INDICATOR ?? {});
  $: ({ decimals } = $REFERENCE_PROCESSED ?? {});
  $: triggerValue = $REFERENCE_PROCESSED
    ? `${formatValue($LEVEL_OF_IMPACT, unit?.uid, { decimals })}${formatUnit(unit)}`
    : '—';
</script>

<Popover class="relative">
  <PopoverButton use={[popperRef]} let:open class="flex flex-col gap-2 w-full text-left focus:outline-none">
    <span class="uppercase text-xs tracking-widest font-bold text-contour-weak inline-block">Level of Impact</span>
    <span class="flex w-full rounded-sm text-sm bg-surface-base justify-between items-center truncate text-theme-base font-bold">
      <span class="leading-tight truncate">{@html triggerValue}</span>
      <ExpandIcon class="min-w-[20px] stroke-current stroke-[1.5]" />
    </span>
  </PopoverButton>

  <PopoverPanel use={[[popperContent, popperOptions]]} class="bg-surface-base shadow-md z-50 rounded border-contour-weakest border p-4 w-72">
    {#if !$IS_EMPTY_GEOGRAPHY && !$IS_EMPTY_INDICATOR && $IS_COMBINATION_AVAILABLE_INDICATOR}
      <LoadingWrapper
        {process}
        let:asyncProps={{ data }}
        asyncProps={{ data: $store }}
        props={{ ...$TEMPLATE_PROPS }}
        warningSizeSmall={true}
        warningBackground={false}
      >
        <ImpactLevel {data} />
        <LoadingPlaceholder slot="placeholder" />
      </LoadingWrapper>
    {/if}
  </PopoverPanel>
</Popover>
