<script>
  import Select from '$lib/components/ui/Select.svelte';
  import { sortBy } from 'lodash-es';
  import {
    CURRENT_INDICATOR_PARAMETERS,
    CURRENT_INDICATOR_OPTION_VALUES,
    IS_COMBINATION_AVAILABLE_INDICATOR,
    PERCENTILE_SCENARIO_AVAILABILITY_REQUEST,
    WARMING_LEVEL_SCENARIO_AVAILABILITY_REQUEST,
  } from '$stores/state.js';
  import { KEY_PARAMETER_INDICATOR_VALUE } from '$config';
  import Button from '$lib/components/ui/Button.svelte';
  import { catalogFlow } from '$stores/catalog-flow.js';

  $: parameters = $CURRENT_INDICATOR_PARAMETERS
    .map((parameter) => ({
      ...parameter,
      value: $CURRENT_INDICATOR_OPTION_VALUES[parameter.uid],
    }))
    .filter((d) => d.options.length > 1);

  // Some indicators have a special parameter that determines their specific value
  // This parameter should be listed first
  $: parametersSorted = sortBy(parameters, ({ uid }) => uid !== KEY_PARAMETER_INDICATOR_VALUE);

  function handleChange({ detail: { key, value } }) {
    void catalogFlow.changeParameters(
      {
        ...$CURRENT_INDICATOR_OPTION_VALUES,
        [key]: value,
      },
      { history: 'push' }
    );
  }
</script>

{#each parametersSorted as parameter}
  <Select disabled={!$IS_COMBINATION_AVAILABLE_INDICATOR} {...parameter} wrapperClass={`flex-col`} on:change={handleChange} />
{/each}

{#if $PERCENTILE_SCENARIO_AVAILABILITY_REQUEST.status === 'failure'}
  <Button variant="secondary" on:click={() => catalogFlow.retryPercentileAvailability()}>Retry chart scenarios</Button>
{/if}
{#if $WARMING_LEVEL_SCENARIO_AVAILABILITY_REQUEST.status === 'failure'}
  <Button variant="secondary" on:click={() => catalogFlow.catalog.loadWarmingLevelAvailability()}>Retry warming scenarios</Button>
{/if}
