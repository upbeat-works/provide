<script>
  export let bounds;
  export let height;
  export let values;
  export let classes;
  export let selectable = false;
  export let fitCountries = [];
  export let geographyType = 'admin0';
</script>

<div role="img" aria-label="Mock country map" data-values={JSON.stringify(values)} data-class-count={classes.length} data-geography-type={geographyType}></div>
