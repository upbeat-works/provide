<script>
  export let zoomRange;
  export let bounds;
  export let fitBoundsOptions;
</script>

<div data-zoom-range={JSON.stringify(zoomRange)} data-bounds={JSON.stringify(bounds)}>Country map</div>
<slot />
