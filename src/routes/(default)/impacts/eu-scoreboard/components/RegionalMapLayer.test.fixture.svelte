<script>
  export let shape;
  export let values = [];
  export let classes = [];
  export let unit = undefined;
</script>

<div role="img" aria-label="Regional map layer" data-shape={JSON.stringify(shape)}></div>
