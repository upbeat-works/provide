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
  export let retry = () => invalidateAll();

  const components = {
    line: LineChart,
    line_with_range: LineChart,
    stacked_bar: StackedBarChart,
    bubble: BubbleChart,
    scatter: BubbleChart,
  };

  $: chart = adaptChartResult(result, selection);
  $: component = components[chart.kind];
  $: graphDownloadParams = graphParamsFor(result.definition, sector, selection);
</script>

{#if chart.status === 'error'}
  <div role="alert">
    <p>{chart.error || 'Chart data could not be loaded.'}</p>
    <button type="button" class="mt-2 font-bold text-theme-base" on:click={retry}>Retry</button>
  </div>
{:else if chart.status === 'ready' && component}
  <svelte:component this={component} {...chart.props} chartInfo={chart.info} chartUid={EMBED_UID} {graphDownloadParams} {staticMode} />
{/if}
