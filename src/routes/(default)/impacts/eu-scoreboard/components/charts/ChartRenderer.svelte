<script>
  import LineChart from './LineChart.svelte';
  import StackedBarChart from './StackedBarChart.svelte';
  import BubbleChart from './BubbleChart.svelte';
  import { adaptChartResult } from './adapter.js';
  import { EMBED_UID, graphParamsFor } from './catalog.js';
  import { invalidateAll } from '$app/navigation';

  export let result;
  export let selection = {};
  export let sector = undefined;
  export let staticMode = false;
  // Set by a chart whose groups are chosen above it, so each group keeps its
  // colour as others are added and removed.
  export let colorFor = undefined;
  // Set by a chart whose series are already named by a picker above it, where a
  // legend would just repeat that list. An empty `legend` is passed rather than
  // omitted, since LineChart falls back to building one from its series.
  export let hideLegend = false;
  export let retry = () => invalidateAll();

  const components = {
    line: LineChart,
    line_with_range: LineChart,
    stacked_bar: StackedBarChart,
    bubble: BubbleChart,
    scatter: BubbleChart,
  };

  $: chart = adaptChartResult(result, selection, { colorFor });
  $: component = components[chart.kind];
  $: graphDownloadParams = graphParamsFor(result.definition, sector, selection);
</script>

{#if chart.status === 'error'}
  <div role="alert">
    <p>{chart.error || 'Chart data could not be loaded.'}</p>
    <button type="button" class="mt-2 font-bold text-theme-base" on:click={retry}>Retry</button>
  </div>
{:else if chart.status === 'ready' && component}
  <svelte:component this={component} {...chart.props} {...(hideLegend ? { legend: [] } : {})} chartInfo={chart.info} chartUid={EMBED_UID} {graphDownloadParams} {staticMode} />
{/if}
