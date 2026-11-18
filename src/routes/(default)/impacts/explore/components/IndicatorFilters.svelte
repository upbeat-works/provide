<script>
  import Select from '$lib/components/ui/Select.svelte';
  import { sortBy } from 'lodash-es';
  import {
    CURRENT_INDICATOR_PARAMETERS,
    CURRENT_INDICATOR_OPTION_VALUES,
    IS_COMBINATION_AVAILABLE_INDICATOR,
  } from '$stores/state.js';
  import { KEY_PARAMETER_INDICATOR_VALUE } from '$config';
  import { catalogFlow } from '$stores/catalog-flow.js';

  $: parameters = $CURRENT_INDICATOR_PARAMETERS
    .map((parameter) => ({
      ...parameter,
      value: $CURRENT_INDICATOR_OPTION_VALUES[parameter.uid],
    }))
    .filter((d) => d.options.length > 0);

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
  <Select disabled={!$IS_COMBINATION_AVAILABLE_INDICATOR || parameter.options.length === 1} {...parameter} wrapperClass={`flex-col`} on:change={handleChange} />
{/each}
