<script>
  export let values = [];
  export let classes = [];
  export let grid = undefined;
  export let countryName;
  export let level;
  export let height;
</script>

<div role="img" aria-label="Mock country map" data-values={JSON.stringify(values)} data-class-count={classes.length} data-country={countryName} data-level={level}></div>
