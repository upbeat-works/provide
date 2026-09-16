<script>
  import ScoreboardMap from './ScoreboardMap.svelte';
  import MapLegendPanel from './MapLegendPanel.svelte';
  import { boundsForGeography, legendOf, numericClasses } from './choropleth.js';
  import { loadResource } from './resource.js';

  export let definition;
  export let result;
  export let selection;
  export let sector;
  $: request = result;
  $: parts = Object.values(selection)
    .filter(Boolean)
    .map(({ label }) => ({ label }));

  function retry() {
    request = loadResource('map', sector, selection).catch(() => ({ definition, status: 'error', values: [], error: 'Map data could not be loaded.' }));
  }
</script>

{#await request}
  <div class="flex h-[560px] items-center justify-center" role="status">Loading map…</div>
{:then map}
  {#if map?.status === 'loading'}
    <div class="flex h-[560px] items-center justify-center" role="status">Loading map…</div>
  {:else}
    {@const values = map?.values ?? []}
    {@const classes = numericClasses(values, definition?.data.unit)}
    {@const legend = legendOf(classes)}
    {@const geographyType = definition?.geographyType ?? 'admin0'}
    <ScoreboardMap bounds={boundsForGeography(geographyType)} height="h-[560px]" {geographyType} {values} {classes} fitCountries={geographyType === 'admin0' ? values.map(({ uid }) => uid) : []} />
    {#if map?.status === 'ready' && values.length}
      <div class="pointer-events-none absolute inset-0 mx-auto max-w-7xl px-6">
        <div class="pointer-events-auto absolute bottom-6 left-6">
          <MapLegendPanel {parts} subtitle={definition.title} scale={legend.scale} labels={legend.labels} />
        </div>
      </div>
    {:else if map?.status === 'error'}
      <div class="absolute bottom-6 left-6 rounded bg-white px-5 py-4 shadow-lg" role="alert">
        <p>{map.error}</p>
        <button type="button" class="mt-2 font-bold text-theme-base" on:click={retry}>Retry map</button>
      </div>
    {/if}
  {/if}
{/await}
