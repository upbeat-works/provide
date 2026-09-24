<script>
  import ScoreboardMap from './ScoreboardMap.svelte';
  import MapLegendPanel from './MapLegendPanel.svelte';
  import FilterSelect from './FilterSelect.svelte';
  import { legendOf, numericClasses } from './choropleth.js';
  import { combinedValues, comparisonViews, legendParts, mapValues } from './comparison.js';
  import { loadResource, mapResourceKey } from './resource.js';

  export let definition;
  export let result;
  export let selection;
  export let sector;
  export let compareBy = undefined;
  export let sides = [];
  export let optionsFor = () => [];

  const loading = () => ({ status: 'loading', values: [], metadata: null });
  const failed = () => ({ status: 'error', values: [], metadata: null, error: 'Map data could not be loaded.' });
  const unavailable = () => ({ status: 'unavailable', values: [], metadata: null });

  let cache = new Map();
  let cacheScope;
  let revision = 0;
  let own = { key: undefined, input: undefined, token: 0, map: loading() };

  $: views = comparisonViews(compareBy?.uid, sides, selection);
  $: scope = `${sector}|${definition?.name ?? ''}`;
  $: resetCache(scope);
  $: ownSelection = withIndicator(selection);
  $: ownKey = mapResourceKey(sector, ownSelection);
  $: syncOwn(ownKey, result);
  $: maps = definition ? collect(views, ownKey, own, revision) : views.map(unavailable);
  $: unit = maps.find((map) => map?.metadata?.unit)?.metadata.unit;
  $: classes = numericClasses(combinedValues(maps), unit);
  $: legend = legendOf(classes, { labelMode: 'boundaries', unit });
  $: compareSelectProps = compareBy?.uid === 'region' ? { placeholder: 'Search region' } : {};

  function withIndicator(view) {
    const name = definition?.name;
    return { ...view, indicator: name ? { uid: name, label: name } : undefined };
  }

  function resetCache(nextScope) {
    if (nextScope === cacheScope) return;
    cacheScope = nextScope;
    cache = new Map();
  }

  function syncOwn(key, input) {
    if (own.key === key && own.input === input) return;
    const token = own.token + 1;
    if (own.key !== undefined && own.input === input) {
      own = { key, input, token, map: loading() };
      return;
    }
    own = { key, input, token, map: loading() };
    if (typeof input?.then === 'function') {
      input.then((map) => settleOwn(key, token, map)).catch(() => settleOwn(key, token, failed()));
      return;
    }
    own = { key, input, token, map: input ?? loading() };
  }

  function settleOwn(key, token, map) {
    if (own.key !== key || own.token !== token) return;
    own = { ...own, map };
  }

  function collect(nextViews, currentKey) {
    return nextViews.map((view) => {
      const key = mapResourceKey(sector, withIndicator(view));
      if (key === currentKey) return own.map;
      return cachedMap(key, view);
    });
  }

  function cachedMap(key, view) {
    let entry = cache.get(key);
    if (entry) return entry.map;
    entry = { map: loading() };
    cache.set(key, entry);
    load(view).then((map) => {
      if (cache.get(key) !== entry) return;
      entry.map = map;
      revision += 1;
    });
    return entry.map;
  }

  function load(view) {
    return loadResource('map', sector, withIndicator(view)).catch(failed);
  }

  function retry(view) {
    const key = mapResourceKey(sector, withIndicator(view));
    if (key === ownKey) {
      const token = own.token + 1;
      own = { ...own, token, map: loading() };
      load(view).then((map) => settleOwn(key, token, map));
      return;
    }
    cache.delete(key);
    revision += 1;
  }

  function chooseSide(index, option) {
    if (sides[index]?.uid === option?.uid) return;
    sides = sides.map((value, i) => (i === index ? option : value));
  }

  function legendSubtitle(map) {
    const model = map?.metadata?.model;
    return model ? `${definition.name} · ${model}` : definition.name;
  }
</script>

{#key views.length}
  <div class="flex" class:gap-px={compareBy}>
    {#each views as view, i (i)}
      {@const map = maps[i] ?? loading()}
      {@const values = map.status === 'ready' ? mapValues(map) : []}
      {@const grid = map.status === 'ready' ? map.grid : undefined}
      <div class="relative min-w-0 flex-1">
        <ScoreboardMap height="h-[560px]" {values} {grid} {classes} {unit} countryName={view.region?.uid} level={definition?.level} />

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

          {#if map.status === 'unavailable'}
            <div class="pointer-events-auto absolute bottom-6 left-6 rounded bg-white px-5 py-4 text-sm text-text-weaker shadow-lg" role="status">
              Regional map data is not available for this sector.
            </div>
          {:else if map.status === 'ready' && values.length}
            <div class="pointer-events-auto absolute bottom-6 left-6">
              <MapLegendPanel parts={legendParts(view, compareBy?.uid)} subtitle={legendSubtitle(map)} scale={legend.scale} labels={legend.labels} ticks={legend.ticks} />
            </div>
          {:else if map.status === 'loading'}
            <div class="pointer-events-auto absolute bottom-6 left-6 rounded bg-white px-5 py-4 text-sm text-text-weaker shadow-lg" role="status">
              Loading map data
            </div>
          {:else if map.status === 'error'}
            <div class="pointer-events-auto absolute bottom-6 left-6 rounded bg-white px-5 py-4 shadow-lg" role="alert">
              <p>{map.error ?? 'Map data could not be loaded.'}</p>
              <button type="button" class="mt-2 font-bold text-theme-base" on:click={() => retry(view)}>Retry map</button>
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
{/key}
