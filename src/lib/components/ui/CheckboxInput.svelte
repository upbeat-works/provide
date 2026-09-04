<script>
  import { createEventDispatcher } from 'svelte';

  export let checked;
  export let value;
  export let disabled;
  // Radio for a single-choice list, checkbox for a multi-select one. Same
  // controlled-input behaviour either way.
  export let type = 'checkbox';

  const dispatch = createEventDispatcher();
  let ref;

  function handleChange() {
    dispatch('change');
    // Enforce checked state so we can have a completely controled checkbox
    ref.checked = checked;
  }
</script>

<input {type} {value} bind:this={ref} {checked} {...$$restProps} on:change={handleChange} aria-disabled={disabled} {disabled} />
