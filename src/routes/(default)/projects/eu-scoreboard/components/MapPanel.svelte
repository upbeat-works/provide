<script>
  import ScoreboardMap from './ScoreboardMap.svelte';
  import MapLegendPanel from './MapLegendPanel.svelte';
  import FilterSelect from './FilterSelect.svelte';
  import MapLoading from './MapLoading.svelte';
  import { boundsForGeography, legendOf, numericClasses } from './choropleth.js';
  import { combinedValues, comparisonViews, legendParts } from './comparison.js';
  import { loadResource } from './resource.js';

  // The indicators view's map band. One map normally; two side by side while a
  // comparison is open, each drawing the shared selection with one dimension
  // swapped for its own — and each with a selector for that dimension, so the
  // control sits on the map it governs.
  export let definition;
  // The map data for the page's own selection, from the page load.
  export let result;
  export let selection;
  export let sector;
  // The dimension being compared (`{ uid, label }`), or undefined.
  export let compareBy = undefined;
  // The compared dimension's value per map; bindable so a pick on one map is
  // held by the page alongside the rest of the comparison state.
  export let sides = [];
  // Options for the compared dimension, keyed by dimension uid.
  export let optionsFor = () => [];

  const DIMENSIONS = ['region', 'scenario', 'year'];
  const signature = (view) => DIMENSIONS.map((dimension) => view?.[dimension]?.uid).join('|');

  $: views = comparisonViews(compareBy?.uid, sides, selection);

  // The page already loaded the map for its own selection; a comparison's sides
  // are chosen in the browser, so those load here. Keyed by what they draw, so
  // re-rendering does not refetch a side that has not changed.
  let cache = new Map();
  // `result` and `compareBy` are passed in rather than read inside `request`:
  // a dependency Svelte only sees inside a called function is not tracked, and
  // a retry that replaces `result` would then never reach the markup.
  $: requests = views.map((view) => request(view, result, compareBy, selection));

  function request(view, own, comparing, shared) {
    // The side still showing the page's own selection keeps the data the page
    // loaded with it — opening a comparison should fetch the side that is new,
    // not both.
    if (!comparing || signature(view) === signature(shared)) return own;
    const key = signature(view);
    if (!cache.has(key)) cache.set(key, load(view));
    return cache.get(key);
  }

  const load = (view) => loadResource('map', sector, view).catch(() => ({ definition, status: 'error', values: [], error: 'Map data could not be loaded.' }));

  // `{#await}` renders its `then` branch synchronously for a plain value, so a
  // map whose data the page already loaded paints on the first frame rather
  // than flashing a loading state. Only wrap in a promise when one is involved.
  const pending = (value) => typeof value?.then === 'function';

  // Rebuilt only when what the band draws actually changes, so an unrelated
  // re-render does not hand `{#await}` a fresh promise and blank both maps back
  // to "Loading" while the data it already has sits resolved behind it.
  let attempt = 0;
  let bandKey;
  let settled = [];
  $: rebuild(views.map(signature).join('::') + `#${attempt}`, requests);

  function rebuild(key, reqs) {
    if (key === bandKey) return;
    bandKey = key;
    settled = reqs.some(pending) ? Promise.all(reqs) : reqs;
  }

  function retry() {
    cache = new Map();
    result = load(selection);
    attempt += 1;
  }

  // Picked rather than bound: a two-way binding writes the chosen option back on
  // every render, and Svelte counts an object as changed every time, so the
  // write would rebuild the band and re-render, round and round. The guard also
  // means re-picking what is already shown costs nothing.
  function chooseSide(index, option) {
    if (sides[index]?.uid === option?.uid) return;
    sides = sides.map((value, i) => (i === index ? option : value));
  }

  $: geographyType = definition?.geographyType ?? 'admin0';
  // The geography selector needs its search wherever it is shown.
  $: compareSelectProps = compareBy?.uid === 'region' ? { placeholder: 'Search region' } : {};
</script>

<!-- Keyed on the number of maps: a mapbox instance does not re-fit when its
     container is resized under it, so splitting the band has to build the maps
     afresh rather than squeeze the existing one into half the width. -->
{#key views.length}
  {#await settled}
    <MapLoading height="h-[560px]" />
  {:then maps}
    {#if maps.some((map) => map?.status === 'loading')}
      <MapLoading height="h-[560px]" />
    {:else}
      <!-- One ramp across both maps, from every value on show. -->
      {@const classes = numericClasses(combinedValues(maps), definition?.data.unit)}
      {@const legend = legendOf(classes)}
      <div class="flex" class:gap-px={compareBy}>
        {#each views as view, i (i)}
          {@const map = maps[i]}
          {@const values = map?.values ?? []}
          <div class="relative min-w-0 flex-1">
            <ScoreboardMap
              bounds={boundsForGeography(geographyType)}
              height="h-[560px]"
              {geographyType}
              {values}
              {classes}
              fitCountries={geographyType === 'admin0' ? values.map(({ uid }) => uid) : []}
            />

            <!-- Overlays sit on the map they belong to. With one map the inner
                 max-w-7xl keeps the card on the same left edge as the content
                 below; side by side, each card belongs to its own half. -->
            <div class="pointer-events-none absolute inset-0 {compareBy ? '' : 'mx-auto max-w-7xl px-6'}">
              {#if compareBy}
                <div class="pointer-events-auto absolute left-6 top-6">
                  <FilterSelect
                    label={compareBy.label}
                    options={optionsFor(compareBy.uid)}
                    selected={sides[i]}
                    on:change={({ detail }) => chooseSide(i, detail)}
                    labelClass="sr-only"
                    wrapperClass="min-w-[12rem]"
                    buttonClass="rounded border border-contour-weakest bg-surface-base px-3 py-2 text-sm shadow-sm"
                    {...compareSelectProps}
                  />
                </div>
              {/if}
              {#if map?.status === 'ready' && values.length}
                <div class="pointer-events-auto absolute bottom-6 left-6">
                  <MapLegendPanel parts={legendParts(view, compareBy?.uid)} subtitle={definition.title} scale={legend.scale} labels={legend.labels} />
                </div>
              {:else if map?.status === 'error'}
                <div class="pointer-events-auto absolute bottom-6 left-6 rounded bg-white px-5 py-4 shadow-lg" role="alert">
                  <p>{map.error}</p>
                  <button type="button" class="mt-2 font-bold text-theme-base" on:click={retry}>Retry map</button>
                </div>
              {:else}
                <div class="pointer-events-auto absolute bottom-6 left-6 rounded bg-white px-5 py-4 text-sm text-text-weaker shadow-lg" role="status">
                  No map data for this selection.
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/await}
{/key}
