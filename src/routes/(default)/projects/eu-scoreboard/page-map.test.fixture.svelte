<script>
  import { createEventDispatcher } from 'svelte';

  export let values = [];
  export let classes = [];
  export let bounds;
  export let height;
  export let selectable;
  const dispatch = createEventDispatcher();
</script>

<div role="img" aria-label="Mock country map" data-values={JSON.stringify(values)} data-class-count={classes.length}></div>
<button type="button" on:click={() => dispatch('select', { uid: 'TUR' })}>Select Turkey</button>
