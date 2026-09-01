<script>
  import MapProvider from '$lib/components/maps/MapboxMap/MapProvider.svelte';
  import ZoomControl from '$lib/components/maps/MapboxMap/ZoomControl.svelte';
  import CountryChoropleth from './CountryChoropleth.svelte';

  // The scoreboard's map band: a country choropleth over the basemap. Both views
  // use it — the ranking view colours countries by their composite score, the
  // indicators view by the selected indicator — so what is mapped comes in as
  // values plus the classes that turn a value into a colour.
  export let bounds = [9.53, 46.37, 17.16, 49.02];
  export let height = 'h-[420px]';
  // `[{ uid, label, value }]`, keyed on the country's alpha-3 geo id (`ITA`).
  export let values = [];
  export let classes = [];
</script>

<div class="{height} w-full">
  <MapProvider {bounds} fitBoundsExtent={40}>
    <ZoomControl />
    <CountryChoropleth {values} {classes} />
    <slot />
  </MapProvider>
</div>
