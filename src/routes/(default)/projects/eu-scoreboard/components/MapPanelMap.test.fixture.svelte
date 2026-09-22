<script>
  export let values = [];
  export let grid = undefined;
  export let classes = [];
  export let countryName;
  export let level;
  export let height;
</script>

<div
  role="img"
  aria-label="Regional scoreboard map"
  data-values={JSON.stringify(values)}
  data-grid={JSON.stringify(grid)}
  data-classes={JSON.stringify(classes)}
  data-country={countryName}
  data-level={level}
></div>
