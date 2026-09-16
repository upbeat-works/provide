<script>
  import ScoreboardLayout from '$lib/components/layouts/ScoreboardLayout.svelte';
  import ScoreboardSection from '$lib/components/layouts/ScoreboardSection.svelte';
  import ScoreboardMap from '../components/ScoreboardMap.svelte';
  import MapLegendPanel from '../components/MapLegendPanel.svelte';
  import SectorSelect from '../components/SectorSelect.svelte';
  import ChartRenderer from '../components/charts/ChartRenderer.svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { PATH_ADAPTATION } from '$config';
  import { isChartVisible } from '../components/charts/adapter.js';
  import { boundsForGeography, legendOf, numericClasses } from '../components/choropleth.js';

  export let data;

  $: visibleCharts = (data.charts ?? []).filter((result) => isChartVisible(result, data.selection));
  $: mapResult = data.map;
  $: mapValues = mapResult?.values ?? [];
  $: mapClasses = numericClasses(mapValues, mapResult?.definition?.data.unit);
  $: mapLegend = legendOf(mapClasses);
  $: geographyType = mapResult?.definition?.geographyType ?? data.scoreboard.mapDefinition?.geographyType ?? 'admin0';
  $: mapParts = [data.selection?.region, data.selection?.scenario, data.selection?.year]
    .filter(Boolean)
    .map(({ label }) => ({ label }));
  function select(key, event) {
    const url = new URL($page.url);
    url.searchParams.set(key, event.currentTarget.value);
    void goto(url, { keepFocus: true, noScroll: true });
  }
</script>

<ScoreboardLayout showSidebar={false}>
  <svelte:fragment slot="filters">
    <SectorSelect scoreboard={data.scoreboard} />
    <label class="flex min-w-[10rem] flex-col text-sm">
      <span>Scenario</span>
      <select aria-label="Scenario" class="mt-1 bg-transparent font-semibold" disabled={!data.scenarios?.length} value={data.selection?.scenario?.uid} on:change={(event) => select('scenario', event)}>
        {#if !data.scenarios?.length}<option>No data</option>{/if}
        {#each data.scenarios ?? [] as option (option.uid)}<option value={option.uid}>{option.label}</option>{/each}
      </select>
    </label>
    <label class="flex min-w-[10rem] flex-col text-sm">
      <span>Region</span>
      <select aria-label="Region" class="mt-1 bg-transparent font-semibold" disabled={!data.regions?.length} value={data.selection?.region?.uid} on:change={(event) => select('region', event)}>
        {#if !data.regions?.length}<option>No data</option>{/if}
        {#each data.regions ?? [] as option (option.uid)}<option value={option.uid}>{option.label}</option>{/each}
      </select>
    </label>
    <label class="flex min-w-[8rem] flex-col text-sm">
      <span>Year</span>
      <select aria-label="Year" class="mt-1 bg-transparent font-semibold" disabled={!data.years?.length} value={data.selection?.year?.uid} on:change={(event) => select('year', event)}>
        {#if !data.years?.length}<option>No data</option>{/if}
        {#each data.years ?? [] as option (option.uid)}<option value={option.uid}>{option.label}</option>{/each}
      </select>
    </label>
  </svelte:fragment>

  <svelte:fragment slot="visual">
    <ScoreboardMap bounds={boundsForGeography(geographyType)} height="h-[560px]" {geographyType} values={mapValues} classes={mapClasses} selectable={false} />
    {#if mapResult?.status === 'ready' && mapValues.length}
      <div class="pointer-events-none absolute inset-0 mx-auto max-w-7xl px-6">
        <div class="pointer-events-auto absolute bottom-6 left-6">
          <MapLegendPanel parts={mapParts} subtitle={mapResult.definition.title} scale={mapLegend.scale} labels={mapLegend.labels} />
        </div>
      </div>
    {:else if mapResult?.status === 'error'}
      <div class="absolute bottom-6 left-6 rounded bg-white px-5 py-4 shadow-lg" role="alert">
        <p>{mapResult.error || 'Map data could not be loaded.'}</p>
        <button type="button" class="mt-2 font-bold text-theme-base" on:click={() => invalidateAll()}>Retry</button>
      </div>
    {/if}
  </svelte:fragment>

  {#if visibleCharts.length}
    <div>
      {#each visibleCharts as result (result.definition.chartId)}
        <ScoreboardSection eyebrow={data.selection?.region?.label ?? 'No region'} slug={result.definition.chartId} title={result.definition.title} description={result.definition.description}>
          {#if result.caseStudy?.slug}
            <a class="mb-4 block text-sm font-bold text-theme-base" href="/{PATH_ADAPTATION}/{result.caseStudy.slug}">See {result.caseStudy.title ?? 'case study'} →</a>
          {/if}
          <ChartRenderer {result} selection={data.selection} sector={data.scoreboard.sector.uid} />
        </ScoreboardSection>
      {/each}
    </div>
  {/if}
</ScoreboardLayout>
