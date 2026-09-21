<script>
  import ScoreboardLayout from '$lib/components/layouts/ScoreboardLayout.svelte';
  import ScoreboardFilters from '../components/ScoreboardFilters.svelte';
  import CompareMenu from '../components/CompareMenu.svelte';
  import ChartPanel from '../components/ChartPanel.svelte';
  import MapPanel from '../components/MapPanel.svelte';
  import SectionIndex from '../components/SectionIndex.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import CopyLink from '$lib/components/ui/CopyLink.svelte';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
  import { seedComparison } from '../components/comparison.js';
  import { PATH_DOCUMENTATION } from '$config';

  export let data;

  // A comparison lifts one dimension out of the filter bar and gives each map
  // its own selector for it; everything else stays shared. The dimensions are
  // the three the scoreboard's data is actually keyed on.
  const dimensions = [
    { uid: 'scenario', label: 'Scenario' },
    { uid: 'region', label: 'Geography' },
    { uid: 'year', label: 'Year' },
  ];
  let compareBy;
  // The compared dimension's value per map. Two entries; only read while
  // comparing.
  let sides = [];

  const optionsFor = (uid) => ({ scenario: data.scenarios, region: data.regions, year: data.years })[uid] ?? [];

  // Seed only when the compared dimension changes. `sides` must not be read
  // here: this statement would then depend on it, and choosing a value on a map
  // would re-seed the pair straight back to what it opened with.
  let seededFor;
  $: if (compareBy?.uid !== seededFor) {
    seededFor = compareBy?.uid;
    sides = compareBy ? seedComparison(optionsFor(compareBy.uid), data.selection?.[compareBy.uid]) : [];
  }

  // The bar keeps everything the comparison has not taken over. The hazard
  // behind the indicator is not this view's concern — the indicator picker
  // carries the same choice.
  $: filters = ['indicator', 'region', 'scenario', 'year'].filter((uid) => uid !== compareBy?.uid);

  // The article column's index, and what the "view charts" button jumps to.
  $: sections = (data.scoreboard.definitions ?? []).map(({ chartId, title }) => ({ slug: chartId, title }));

  let contentRef;
  let activeSlug;
</script>

<ScoreboardLayout showSidebar={sections.length > 0}>
  <svelte:fragment slot="filters"><ScoreboardFilters {data} {filters} /></svelte:fragment>

  <svelte:fragment slot="actions">
    <CompareMenu {dimensions} bind:selected={compareBy} />
  </svelte:fragment>

  <svelte:fragment slot="visual">
    <MapPanel definition={data.scoreboard.mapDefinition} result={data.map} selection={data.selection} sector={data.scoreboard.sector.uid} {compareBy} bind:sides {optionsFor} />
    {#if !compareBy && sections.length}
      <!-- A full-width strip laid over the map to centre one button, so it must
           not take clicks meant for the legend card underneath it. -->
      <div class="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
        <Button class="pointer-events-auto" href="#{sections[0].slug}">
          View {data.scoreboard.sector.label} charts
          <LinkArrow />
        </Button>
      </div>
    {/if}
  </svelte:fragment>

  <svelte:fragment slot="sidebar">
    <SectionIndex {sections} {contentRef} bind:activeSlug />
    <div class="mt-8 flex flex-col items-start gap-5">
      <CopyLink />
      <Button href="/{PATH_DOCUMENTATION}" variant="secondary" class="w-full justify-between text-left">
        Learn more about the methodology
        <LinkArrow />
      </Button>
    </div>
  </svelte:fragment>

  <div bind:this={contentRef}>
    {#each data.charts ?? [] as chart (chart.definition.chartId)}
      <ChartPanel {...chart} selection={data.selection} sector={data.scoreboard.sector.uid} accent={activeSlug === chart.definition.chartId} />
    {/each}
  </div>
</ScoreboardLayout>
