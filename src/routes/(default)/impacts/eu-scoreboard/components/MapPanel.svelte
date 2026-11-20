<script>
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import ScoreboardMap from './ScoreboardMap.svelte';
  import MapLegendPanel from './MapLegendPanel.svelte';
  import FilterSelect from './FilterSelect.svelte';
  import { legendOf, numericClasses } from './choropleth.js';
  import { combinedValues, comparisonViews, legendParts, mapValues } from './comparison.js';
  import { startResource, mapResourceKey } from './resource.js';
  import { mapBoundaryLevel } from '../../../../../../api/scoreboard/choices.js';
  import { SCOREBOARD_COUNTRIES } from '../../../../../../api/scoreboard/countries.ts';

  export let definition;
  export let result;
  export let selection;
  export let sector;
  export let preview = undefined;
  export let compareBy = undefined;
  export let sides = [];
  export let optionsFor = () => [];

  const countriesByIso3 = new Map(SCOREBOARD_COUNTRIES.map((country) => [country.iso3, country]));

  const loading = () => ({ status: 'loading', values: [], metadata: null });
  const failed = () => ({ status: 'error', values: [], metadata: null, error: 'Map data could not be loaded.' });
  const unavailable = () => ({ status: 'unavailable', values: [], metadata: null });

  let comparisons = new Map();
  let revision = 0;
  let own = { key: undefined, input: undefined, request: undefined, map: loading() };

  $: views = comparisonViews(compareBy?.uid, sides, selection);
  $: ownSelection = withIndicator(selection, definition);
  $: ownKey = mapResourceKey(sector, ownSelection);
  $: syncOwn(ownKey, result, ownSelection, sector, preview);
  $: syncComparisons(views, ownKey, sector, preview, definition);
  $: maps = definition ? collect(views, ownKey, own, revision) : views.map(unavailable);
  onDestroy(() => {
    own.request?.lease?.release();
    own = { ...own, request: undefined };
    for (const entry of comparisons.values()) entry.request.lease.release();
    comparisons.clear();
  });
  $: unit = maps.find((map) => map?.metadata?.unit)?.metadata.unit;
  // A sector's JSON may give an indicator its own `colorRamp`; without one the
  // choropleth keeps the default ramp.
  $: classes = numericClasses(combinedValues(maps), unit, definition?.colorRamp);
  $: legend = legendOf(classes, { labelMode: 'boundaries' });
  $: compareSelectProps = compareBy?.uid === 'region' ? { placeholder: 'Search region' } : {};

  function withIndicator(view, definition) {
    const name = definition?.name;
    return { ...view, indicator: name ? { uid: name, label: name } : undefined };
  }

  function syncOwn(key, input, selected, nextSector, draft) {
    if (own.key === key && own.input === input) return;
    const previous = own;
    if (browser && input?.status === 'loading' && draft === undefined) {
      observeOwn(key, input, startResource('map', nextSector, selected, fetch, { onError: failed }));
      return;
    }
    if (previous.key !== undefined && previous.input === input) {
      own = { key, input, map: loading() };
      previous.request?.lease?.release();
      return;
    }
    observeOwn(key, input, input);
  }

  function observeOwn(key, input, request) {
    const previous = own.request;
    const lease = request?.lease;
    const entry = { key, input, request, map: loading() };
    own = entry;
    if (previous !== request) previous?.lease?.release();
    if (typeof request?.then !== 'function') {
      own = { ...entry, map: request ?? loading() };
      return;
    }
    function publish(map) {
      if (own.request === request && own.key === key) own = { ...own, map };
    }
    if (lease?.success !== undefined) publish(lease.success);
    lease?.subscribe(publish);
    request.then(publish, () => publish(failed()));
  }

  function collect(nextViews, currentKey) {
    return nextViews.map((view) => {
      const key = mapResourceKey(sector, withIndicator(view, definition));
      if (key === currentKey) return own.map;
      return comparisons.get(key)?.map ?? loading();
    });
  }

  function syncComparisons(nextViews, currentKey, nextSector, nextPreview, nextDefinition) {
    if (!browser) return;
    const active = new Set();
    if (nextDefinition) {
      for (const view of nextViews) {
        const selected = withIndicator(view, nextDefinition);
        const key = mapResourceKey(nextSector, selected);
        if (key === currentKey) continue;
        active.add(key);
        const existing = comparisons.get(key);
        if (!existing || existing.preview !== nextPreview) startComparison(key, selected, nextSector, nextPreview);
      }
    }
    for (const [key, entry] of comparisons) {
      if (active.has(key)) continue;
      comparisons.delete(key);
      entry.request.lease.release();
    }
    revision += 1;
  }

  function startComparison(key, selected, nextSector, nextPreview, options = {}) {
    const previous = comparisons.get(key);
    const request = startResource('map', nextSector, selected, fetch, { preview: nextPreview, onError: failed, ...options });
    const entry = { request, preview: nextPreview, map: request.lease.success ?? loading() };
    comparisons.set(key, entry);
    previous?.request.lease.release();
    function publish(map) {
      if (comparisons.get(key) !== entry) return;
      entry.map = map;
      revision += 1;
    }
    request.lease.subscribe(publish);
    request.then(publish);
  }

  function retry(view) {
    const selected = withIndicator(view, definition);
    const key = mapResourceKey(sector, selected);
    if (key === ownKey) {
      observeOwn(key, own.input, startResource('map', sector, selected, fetch, { preview, retry: true, onError: failed }));
      return;
    }
    startComparison(key, selected, sector, preview, { retry: true });
    revision += 1;
  }

  function chooseSide(index, option) {
    if (sides[index]?.uid === option?.uid) return;
    sides = sides.map((value, i) => (i === index ? option : value));
  }

  const countryLevel = (view) => mapBoundaryLevel(definition, view.region?.uid) === 'NUTS0';

  // A click picks the country as the geography. Comparing geographies, it is
  // that map's side that changes; otherwise it is the shared filter, as the
  // filter bar would set it.
  function selectCountry(index, iso3) {
    const country = countriesByIso3.get(iso3);
    if (!country) return;
    if (compareBy?.uid === 'region') {
      chooseSide(index, optionsFor('region').find(({ uid }) => uid === country.name) ?? { uid: country.name, label: country.name });
      return;
    }
    const url = new URL($page.url);
    url.searchParams.set('region', country.name);
    void goto(url, { keepFocus: true, noScroll: true });
  }

  // The legend's ticks are bare numbers, so the unit is named here — once —
  // alongside what is mapped and the model behind it.
  function legendSubtitle(map) {
    const model = map?.metadata?.model;
    const name = unit ? `${definition.name} (${unit})` : definition.name;
    return model ? `${name} · ${model}` : name;
  }
</script>

{#key views.length}
  <div class="flex" class:gap-px={compareBy}>
    {#each views as view, i (i)}
      {@const map = maps[i] ?? loading()}
      {@const values = map.status === 'ready' ? mapValues(map) : []}
      {@const grid = map.status === 'ready' ? map.grid : undefined}
      <div class="relative min-w-0 flex-1">
        <ScoreboardMap
          height="h-[560px]"
          {values}
          {grid}
          {classes}
          {unit}
          countryName={view.region?.uid}
          level={mapBoundaryLevel(definition, view.region?.uid)}
          selectable={countryLevel(view)}
          activation
          on:select={({ detail }) => selectCountry(i, detail.uid)}
        />

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
              <MapLegendPanel
                parts={legendParts(view, compareBy?.uid)}
                subtitle={legendSubtitle(map)}
                scale={legend.scale}
                labels={legend.labels}
                ticks={legend.ticks}
                {definition}
                level={mapBoundaryLevel(definition, view.region?.uid)}
                metadata={map.metadata}
                {grid}
              />
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
