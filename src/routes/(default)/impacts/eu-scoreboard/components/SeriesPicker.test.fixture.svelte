<script>
  import SeriesPicker from './SeriesPicker.svelte';

  // Binds the picker the way ChartPanel does and writes the selection into the
  // DOM, so a test can assert on what the parent receives rather than reaching
  // into the component for a prop.
  export let groups = [];
  export let selected = [];
  export let colors = undefined;
</script>

<SeriesPicker {groups} bind:selected {colors} />
<p data-testid="selected">{selected.join(',')}</p>
