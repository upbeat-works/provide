<script>
  export let grid;
  export let classes = [];
  export let mask = undefined;
</script>

<div role="img" aria-label="Raster map layer" data-grid={JSON.stringify(grid)} data-classes={JSON.stringify(classes)} data-mask={JSON.stringify(mask)}></div>
