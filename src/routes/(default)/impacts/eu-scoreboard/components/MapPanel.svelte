<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import ScoreboardMap from './ScoreboardMap.svelte';
  import MapLegendPanel from './MapLegendPanel.svelte';
  import FilterSelect from './FilterSelect.svelte';
  import { legendOf, numericClasses } from './choropleth.js';
  import { combinedValues, comparisonViews, legendParts, mapValues } from './comparison.js';
  import { loadResource, mapResourceKey } from './resource.js';
  import { SCOREBOARD_COUNTRIES } from '../../../../../../api/scoreboard/countries.ts';

  export let definition;
  export let result;
  export let selection;
  export let sector;
  export let compareBy = undefined;
  export let sides = [];
  export let optionsFor = () => [];

  const countriesByIso3 = new Map(SCOREBOARD_COUNTRIES.map((country) => [country.iso3, country]));

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
  // A sector's JSON may give an indicator its own `colorRamp`; without one the
  // choropleth keeps the default ramp.
  $: classes = numericClasses(combinedValues(maps), unit, definition?.colorRamp);
  $: legend = legendOf(classes, { labelMode: 'boundaries' });
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

  // Only the Europe-wide view draws whole countries, so only it can be clicked.
  // A single country is drawn as its NUTS regions, which are not offered as a
  // selection.
  const countryLevel = (view) => view.region?.uid === 'all';

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
          level={definition?.level}
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
