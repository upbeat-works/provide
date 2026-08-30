<script>
  import MapProvider from '$lib/components/maps/MapboxMap/MapProvider.svelte';
  import ZoomControl from '$lib/components/maps/MapboxMap/ZoomControl.svelte';

  // The scoreboard's map band. Basemap only for now — no data layers, since
  // there are no scoreboard endpoints yet. Layers (choropleth, outline) slot
  // into MapProvider the way explore's Maps.svelte does when they land.
  // Austria's bbox matches the placeholder geography used elsewhere on the page.
  export let bounds = [9.53, 46.37, 17.16, 49.02];
  export let height = 'h-[420px]';
</script>

<div class="{height} w-full">
  <MapProvider {bounds} fitBoundsExtent={40}>
    <ZoomControl />
    <slot />
  </MapProvider>
</div>
