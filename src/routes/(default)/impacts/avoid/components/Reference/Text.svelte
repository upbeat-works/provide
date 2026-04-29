<script>
  import { CURRENT_INDICATOR_LABEL, CURRENT_INDICATOR, CURRENT_GEOGRAPHY, CURRENT_INDICATOR_OPTIONS } from '$stores/state.js';
  import { IS_STUDY_LOCATION_WHOLE_URBAN_AREA, SELECTED_STUDY_LOCATION_LABEL, REFERENCE_PROCESSED } from '$stores/avoid.js';
  import { formatValue, formatUnit } from '$lib/utils/formatting';
  import Interactive from '../ThresholdLevels/Interactive.svelte';

  $: ({ unit } = $CURRENT_INDICATOR ?? {});
  $: ({ labelWithinSentence } = $CURRENT_INDICATOR_LABEL ?? {});
  $: ({ average_value, countable } = $REFERENCE_PROCESSED ?? {});
  $: ({ reference } = $CURRENT_INDICATOR_OPTIONS ?? {});
  $: isWholeUrbanArea = $IS_STUDY_LOCATION_WHOLE_URBAN_AREA;
  $: period = reference?.labelAvoid ?? reference?.label;
  $: value = formatValue(average_value, unit?.uid);
</script>

{#if $REFERENCE_PROCESSED}
<p class="text-lg leading-relaxed max-w-4xl">
  Over the <Interactive>{period}</Interactive> period, the
  {#if isWholeUrbanArea}
    <Interactive>urban area</Interactive> of <Interactive>{$CURRENT_GEOGRAPHY?.label}</Interactive>
  {:else}
    <Interactive>{$SELECTED_STUDY_LOCATION_LABEL}</Interactive> in <Interactive>{$CURRENT_GEOGRAPHY?.label}</Interactive>
  {/if}
  experienced
  {#if countable}
    on average <Interactive>{@html value}</Interactive> <Interactive>{labelWithinSentence}</Interactive>.
  {:else}
    <Interactive>{labelWithinSentence}</Interactive> of <Interactive>{value}{@html formatUnit(unit)}</Interactive>.
  {/if}
</p>
{/if}
