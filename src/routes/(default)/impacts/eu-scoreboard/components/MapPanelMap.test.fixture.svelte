<script>
  import { createEventDispatcher } from 'svelte';

  export let values = [];
  export let grid = undefined;
  export let classes = [];
  export let unit = undefined;
  export let countryName;
  export let level;
  export let height;
  export let selectable = false;
  export let activation = false;

  // Stands in for a click on a country: the real map dispatches its ISO3 code.
  const dispatch = createEventDispatcher();
</script>

<div
  role="img"
  aria-label="Regional scoreboard map"
  data-values={JSON.stringify(values)}
  data-grid={JSON.stringify(grid)}
  data-classes={JSON.stringify(classes)}
  data-country={countryName}
  data-level={level}
  data-selectable={selectable}
  data-activation={activation}
></div>
{#if selectable}
  <button type="button" on:click={() => dispatch('select', { uid: 'AUT' })}>Select Austria</button>
{/if}
