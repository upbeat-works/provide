<script>
  import { browser } from '$app/environment';
  import MapProvider from '$lib/components/maps/MapboxMap/MapProvider.svelte';
  import ZoomControl from '$lib/components/maps/MapboxMap/ZoomControl.svelte';
  import NutsChoropleth from './NutsChoropleth.svelte';
  import RegionalChoropleth from './RegionalChoropleth.svelte';
  import { countriesBounds, COUNTRY_SOURCE } from './choropleth.js';
  import { loadRegionalBoundaries } from '../../../../../../api/scoreboard/boundaries.ts';
  import { scoreboardCountry } from '../../../../../../api/scoreboard/countries.ts';
  import MapLoading from './MapLoading.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  export let bounds = [-12, 34, 34, 61];
  export let height = 'h-[420px]';
  export let values = [];
  export let classes = [];
  export let highlight = undefined;
  export let fitCountries = [];
  export let padding = 48;
  export let selectable = false;
  export let countryName = undefined;
  export let level = undefined;

  let shapes = start();

  function start() {
    if (!browser) return new Promise(() => {});
    return load();
  }

  async function load() {
    const response = await fetch(COUNTRY_SOURCE);
    if (!response.ok) throw new Error(`${COUNTRY_SOURCE} → ${response.status}`);
    return response.json();
  }

  const retry = () => {
    shapes = load();
  };

  let boundaryAttempt = 0;
  let boundaryRequest = 0;
  let startedBoundaryKey;
  let regionalState = { status: 'idle', shape: undefined };

  $: country = scoreboardCountry(countryName);
  $: regionalKey = country && level ? `${country.code}|${level}|${boundaryAttempt}` : '';
  $: loadRegions(regionalKey, country?.code, level);

  async function loadRegions(key, countryCode, nutsLevel) {
    if (key === startedBoundaryKey) return;
    startedBoundaryKey = key;
    const request = ++boundaryRequest;
    if (!key || !browser) {
      regionalState = { status: 'idle', shape: undefined };
      return;
    }
    regionalState = { status: 'loading', shape: undefined };
    try {
      const shape = await loadRegionalBoundaries(countryCode, nutsLevel);
      if (request !== boundaryRequest) return;
      regionalState = { status: shape.features.length ? 'ready' : 'empty', shape };
    } catch (error) {
      if (request !== boundaryRequest) return;
      regionalState = { status: 'error', shape: undefined };
    }
  }

  function retryBoundaries() {
    boundaryAttempt += 1;
  }

  $: selectedIso3 = country?.iso3 ?? highlight;
  $: framedCountries = selectedIso3 ? [selectedIso3] : fitCountries;
  $: regional = Boolean(country && level);
  const zoomRange = [-1, 14];
</script>

<div class="relative {height} w-full" aria-live="polite">
  {#await shapes}
    <MapLoading />
  {:then shape}
    {@const frame = (framedCountries.length && countriesBounds(shape, framedCountries)) || bounds}
    <MapProvider bounds={frame} fitBoundsOptions={{ padding }} {zoomRange}>
      <ZoomControl />
      {#if regionalState.status === 'ready'}
        <RegionalChoropleth shape={regionalState.shape} {values} {classes} />
      {/if}
      <NutsChoropleth
        {shape}
        values={regional ? [] : values}
        classes={regional ? [] : classes}
        highlight={selectedIso3}
        {selectable}
        on:select
      />
      <slot />
    </MapProvider>
    {#if regionalState.status === 'loading'}
      <div class="absolute right-6 top-6 rounded bg-white px-4 py-3 text-sm text-text-weaker shadow-lg" role="status">Loading regional boundaries</div>
    {:else if regionalState.status === 'error'}
      <div class="absolute right-6 top-6 rounded bg-white px-4 py-3 shadow-lg" role="alert">
        <p class="text-sm text-text-weaker">Regional boundaries could not be loaded.</p>
        <Button variant="secondary" size="sm" on:click={retryBoundaries}>Retry boundaries</Button>
      </div>
    {/if}
    <p class="absolute bottom-1 right-2 rounded bg-white/80 px-1 text-[10px] text-text-weaker">
      Source: IIASA Scenario Services team · EUROSTAT NUTS 2024 · CC BY 4.0
    </p>
  {:catch}
    <div class="flex h-full flex-col items-center justify-center gap-3" role="alert">
      <p class="text-sm text-text-weaker">Country map details could not be loaded.</p>
      <Button variant="secondary" size="sm" on:click={retry}>Retry map</Button>
    </div>
  {/await}
</div>
