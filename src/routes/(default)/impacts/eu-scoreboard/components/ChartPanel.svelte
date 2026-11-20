<script>
  import ScoreboardSection from '$lib/components/layouts/ScoreboardSection.svelte';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import ChartWithSeriesPicker from './charts/ChartWithSeriesPicker.svelte';
  import { isChartVisible } from './charts/adapter.js';
  import { PATH_ADAPTATION } from '$config';
  import { loadResource } from './resource.js';
  import { chartEyebrow } from './comparison.js';
  import { SCOREBOARD_INSTANCE } from '../../../../../../api/scoreboard/choices.js';

  export let definition;
  export let result;
  export let selection;
  export let sector;
  export let preview = undefined;
  // True while the page compares two maps; the eyebrow then names the scenario and year too.
  export let comparing = false;

  let chart;
  let settled = 0;

  $: eyebrow = chartEyebrow(selection, comparing);
  $: sync(result);

  const failed = () => ({ definition, status: 'error', error: 'Chart data could not be loaded.', data: [] });

  // A result that is already a value is taken synchronously: the page hands one
  // over on first render, and deferring it by even a microtask would blank the
  // chart between every selection change.
  function sync(input) {
    const token = ++settled;
    if (typeof input?.then !== 'function') {
      chart = input;
      return;
    }
    chart = undefined;
    input.then(
      (next) => token === settled && (chart = next),
      () => token === settled && (chart = failed())
    );
  }

  function retry() {
    sync(loadResource(`charts/${encodeURIComponent(definition.chartId)}`, sector, selection, fetch, { preview }).catch(failed));
  }
</script>

{#if !chart || chart.status === 'loading'}
  <ScoreboardSection {eyebrow} slug={definition.chartId} title={definition.title} description={definition.description}>
    <div class="flex min-h-[360px] items-center justify-center" aria-busy="true">
      <LoadingPlaceholder />
    </div>
  </ScoreboardSection>
{:else if preview && !isChartVisible(chart, selection)}
  <ScoreboardSection slug={definition.chartId} title={definition.title} description={definition.description}>
    <p role="status">No chart data for this selection.</p>
  </ScoreboardSection>
{:else if isChartVisible(chart, selection)}
  <ScoreboardSection {eyebrow} slug={definition.chartId} title={definition.title} description={definition.description}>
    {#if chart.caseStudy?.slug}
      <a class="mb-4 block text-sm font-bold text-theme-base" href="/{PATH_ADAPTATION}/{chart.caseStudy.slug}">See {chart.caseStudy.title ?? 'case study'} →</a>
    {/if}

    <ChartWithSeriesPicker instance={SCOREBOARD_INSTANCE} result={chart} {selection} {retry} staticMode={Boolean(preview)} />
  </ScoreboardSection>
{/if}
