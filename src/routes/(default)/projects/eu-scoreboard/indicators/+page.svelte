<script>
  import ScoreboardLayout from '$lib/components/layouts/ScoreboardLayout.svelte';
  import ScoreboardFilters from '../components/ScoreboardFilters.svelte';
  import ChartPanel from '../components/ChartPanel.svelte';
  import MapPanel from '../components/MapPanel.svelte';

  export let data;
</script>

<ScoreboardLayout showSidebar={false}>
  <svelte:fragment slot="filters"><ScoreboardFilters {data} /></svelte:fragment>
  <svelte:fragment slot="visual">
    <MapPanel definition={data.scoreboard.mapDefinition} result={data.map} selection={data.selection} sector={data.scoreboard.sector.uid} />
  </svelte:fragment>
  {#each data.charts ?? [] as chart (chart.definition.chartId)}
    <ChartPanel {...chart} selection={data.selection} sector={data.scoreboard.sector.uid} />
  {/each}
</ScoreboardLayout>
