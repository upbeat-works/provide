<script>
  import ScoreboardSection from '$lib/components/layouts/ScoreboardSection.svelte';
  import ChartRenderer from './charts/ChartRenderer.svelte';
  import { isChartVisible } from './charts/adapter.js';
  import { PATH_ADAPTATION } from '$config';
  import { loadResource } from './resource.js';

  export let definition;
  export let result;
  export let selection;
  export let sector;
  // Marks the section the index has scrolled to, the way the ranking view does.
  export let accent = false;
  $: request = result;

  function retry() {
    request = loadResource(`charts/${encodeURIComponent(definition.chartId)}`, sector, selection).catch(() => ({ definition, status: 'error', error: 'Chart data could not be loaded.', data: [] }));
  }
</script>

{#await request}
  <p class="py-8" role="status">Loading {definition.title}…</p>
{:then chart}
  {#if chart?.status === 'loading'}
    <p class="py-8" role="status">Loading {definition.title}…</p>
  {:else if chart && isChartVisible(chart, selection)}
    <ScoreboardSection eyebrow={selection.region?.label ?? 'No region'} slug={definition.chartId} title={definition.title} description={definition.description} {accent}>
      {#if chart.caseStudy?.slug}
        <a class="mb-4 block text-sm font-bold text-theme-base" href="/{PATH_ADAPTATION}/{chart.caseStudy.slug}">See {chart.caseStudy.title ?? 'case study'} →</a>
      {/if}
      <ChartRenderer result={chart} {selection} {sector} {retry} />
    </ScoreboardSection>
  {/if}
{/await}
