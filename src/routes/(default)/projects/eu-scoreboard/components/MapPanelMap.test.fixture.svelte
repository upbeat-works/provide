<script>
  export let values = [];
  export let classes = [];
  export let countryName;
  export let level;
  export let height;
</script>

<div
  role="img"
  aria-label="Regional scoreboard map"
  data-values={JSON.stringify(values)}
  data-classes={JSON.stringify(classes)}
  data-country={countryName}
  data-level={level}
></div>
