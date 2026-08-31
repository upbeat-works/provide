<script>
  import Select from '$lib/components/ui/Select.svelte';
  import { AVOID_PARAMETERS, AVOID_PARAMS } from '$stores/avoid-catalog.js';

  function onChange(e) {
    AVOID_PARAMS.update((p) => ({ ...p, [e.detail.key]: e.detail.value }));
  }
</script>

{#each $AVOID_PARAMETERS as param (param.uid)}
  <Select
    uid={param.uid}
    label={param.label}
    description={param.description}
    options={param.options}
    value={$AVOID_PARAMS[param.uid]}
    wrapperClass="flex-col"
    on:change={onChange}
  />
{/each}
