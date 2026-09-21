<script>
  import { browser } from '$app/environment';
  import MapProvider from '$lib/components/maps/MapboxMap/MapProvider.svelte';
  import ZoomControl from '$lib/components/maps/MapboxMap/ZoomControl.svelte';
  import NutsChoropleth from './NutsChoropleth.svelte';
  import R9Choropleth from './R9Choropleth.svelte';
  import { countriesBounds, COUNTRY_SOURCE } from './choropleth.js';
  import MapLoading from './MapLoading.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  // The scoreboard's map band: a country choropleth over the basemap. Both views
  // use it — the ranking view colours countries by their composite score, the
  // indicators view by the selected indicator — so what is mapped comes in as
  // values plus the classes that turn a value into a colour.
  export let bounds = [9.53, 46.37, 17.16, 49.02];
  export let height = 'h-[420px]';
  // `[{ uid, label, value }]`, keyed on the country's alpha-3 geo id (`ITA`).
  export let values = [];
  export let classes = [];
  export let geographyType = 'admin0';
  // Geo id of the country the view is scoped to, if any. The map outlines it and
  // frames it; with none, it frames `bounds` — the whole coverage.
  export let highlight = undefined;
  export let fitCountries = [];
  // Keeps the fitted shape off the edges of the band. A fixed inset rather than
  // a fraction of the width, so a map narrowed by a comparison keeps it.
  export let padding = 48;
  // Set where `select` is handled — clicking a scored country then opens it.
  export let selectable = false;

  // The country layer draws from a bundled geojson, and the band needs the same
  // geometry to frame the selection, so it is fetched here and handed down —
  // once per band, however often the values or the framing change afterwards.
  // Which map a band is stays fixed for its lifetime (both callers read it off
  // the map definition), so this is settled at construction rather than
  // reactively; the R9 map draws its own source and needs none of it.
  let shapes = start();

  function start() {
    // Nothing to fetch a relative path from on the server, and no map to draw
    // there either — hold the pending branch and let hydration do the work.
    if (!browser) return new Promise(() => {});
    return geographyType === 'r9' ? Promise.resolve(undefined) : load();
  }

  async function load() {
    const response = await fetch(COUNTRY_SOURCE);
    if (!response.ok) throw new Error(`${COUNTRY_SOURCE} → ${response.status}`);
    return response.json();
  }

  const retry = () => {
    shapes = load();
  };

  $: framedCountries = highlight ? [highlight] : fitCountries;
  const zoomRange = [-1, 14];
</script>

<div class="relative {height} w-full" aria-live="polite">
  {#await shapes}
    <MapLoading />
  {:then shape}
    {@const frame = (framedCountries.length && countriesBounds(shape, framedCountries)) || bounds}
    <MapProvider bounds={frame} fitBoundsOptions={{ padding }} {zoomRange}>
      <ZoomControl />
      {#if geographyType === 'r9'}
        <R9Choropleth {values} {classes} />
      {:else}
        <NutsChoropleth {shape} {values} {classes} {highlight} {selectable} on:select />
      {/if}
      <slot />
    </MapProvider>
    <p class="absolute bottom-1 right-2 rounded bg-white/80 px-1 text-[10px] text-text-weaker">
      {#if geographyType === 'r9'}
        Source: IIASA Scenario Services team · Natural Earth · CC BY 4.0
      {:else}
        Source: IIASA Scenario Services team · EUROSTAT NUTS 2024 · CC BY 4.0
      {/if}
    </p>
  {:catch}
    <div class="flex h-full flex-col items-center justify-center gap-3" role="alert">
      <p class="text-sm text-text-weaker">Country map details could not be loaded.</p>
      <Button variant="secondary" size="sm" on:click={retry}>Retry map</Button>
    </div>
  {/await}
</div>
