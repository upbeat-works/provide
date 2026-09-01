<script>
  import ScoreboardLayout from '$lib/components/layouts/ScoreboardLayout.svelte';
  import ScoreboardSection from '$lib/components/layouts/ScoreboardSection.svelte';
  import SelectionButton from '$lib/components/controls/components/SelectionButton.svelte';
  import ScenarioSelection from '$lib/components/controls/ScenarioSelection/ScenarioSelection.svelte';
  import { SCENARIOS } from '$stores/meta.js';
  import Button from '$lib/components/ui/Button.svelte';
  import CopyLink from '$lib/components/ui/CopyLink.svelte';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
  import Compare from '$lib/components/icons/Compare.svelte';
  import ScoreboardMap from '../components/ScoreboardMap.svelte';
  import MapLegendPanel from '../components/MapLegendPanel.svelte';
  import SectionIndex from '../components/SectionIndex.svelte';
  import ChartPlaceholder from '../components/ChartPlaceholder.svelte';
  import LinkSection from '../../../impacts/explore/components/ImpactGeo/LinkSection.svelte';
  import { legendOf } from '../components/choropleth.js';
  import { INDICATOR_CLASSES, indicatorValues } from '../components/scores.js';
  import { findCaseStudy } from '$lib/catalog/case-study-link.js';
  import { PATH_ADAPTATION, PATH_DOCUMENTATION } from '$config';

  export let data;

  // Structure-only view: the controls, the map layers and every chart below are
  // placeholders — there are no scoreboard endpoints yet, so what's real here
  // is the layout it will be poured into.
  const scope = 'Europe';
  const hazard = 'Heat Stress';
  const indicator = 'Annual maximum temperature';

  // Whole of Europe, matching the ranking view's frame.
  const europeBounds = [-24, 34, 42, 68];

  // Sequential ramp for a single indicator, where the ranking view's map runs a
  // diverging risk scale. Palette oranges, low to high — the map's own classes,
  // so the legend can't drift from what is drawn.
  const { scale: indicatorScale, labels: indicatorScaleLabels } = legendOf(INDICATOR_CLASSES);

  // Stands in for the selected geography until the scoreboard has a selection;
  // findCaseStudy falls back to the default study when nothing covers it.
  const placeholderGeography = { label: 'Lisbon', uid: 'lisbon' };
  $: caseStudy = findCaseStudy(data.caseStudies, placeholderGeography);

  // Scenario is the one real control — it opens explore's scenario modal — so
  // the placeholders around it are listed as what comes before and after it.
  const filtersBefore = [
    { label: 'Geography', value: 'All countries' },
    { label: 'Indicator', value: indicator },
  ];
  const filtersAfter = [{ label: 'Year', value: '2025' }];

  // One entry per chart. `short` is what the index calls it — the headings name
  // the model behind the chart, which is too long for the index column.
  const scenarioLegend = ['SSP5 uncertainty band', 'SSP5-8.5 (high)', 'SSP2-4.5 (mid)', 'SSP1-2.6 (low)'];
  const countryLegend = ['Spain', 'Greece', 'Italy', 'Portugal', 'France'];

  const charts = [
    {
      slug: 'annual-mean-temperature',
      short: 'Mean temperature',
      title: 'Annual mean temperature (MESMER)',
      description: 'How the yearly average temperature moves under each pathway, with the spread across the ensemble shown as a band around the high scenario.',
      label: 'Scenario trajectories over time',
      legend: scenarioLegend,
    },
    {
      slug: 'annual-maximum-temperature',
      short: 'Maximum temperature',
      title: 'Annual maximum temperature (MESMER)',
      description: 'The hottest day of the year, which drives heat stress thresholds far more directly than the annual mean does.',
      label: 'Scenario trajectories over time',
      legend: scenarioLegend,
    },
    {
      slug: 'population-exposed',
      short: 'Population exposed',
      title: 'Population exposed to extreme temperature values (CLIMADA)',
      description: 'How many people live where extreme temperatures are reached, broken down by region and stacked from the lowest pathway upwards.',
      label: 'Stacked bar chart by region',
      legend: ['Base – SSP1-2.6', 'up to SSP2-4.5', 'up to SSP5-8.5'],
      height: 'h-[420px]',
      caseStudy: true,
    },
    {
      slug: 'lifetime-exposure',
      short: 'Lifetime exposure',
      title: 'Lifetime exposure to heatwaves',
      description: 'The number of heatwaves a person born today can expect to live through, under each pathway.',
      label: 'Scenario trajectories over time',
      legend: scenarioLegend,
      caseStudy: true,
    },
    {
      slug: 'heat-related-facilities',
      short: 'Heat-related facilities',
      title: 'Heat-related facilities (CLIMADA)',
      description: 'Exposure of health and care facilities to heat, compared across countries rather than across scenarios.',
      label: 'Multi-country trajectories',
      legend: countryLegend,
      caseStudy: true,
    },
    {
      slug: 'economic-damages',
      short: 'Economic damages',
      title: 'Heatwaves — economic damages',
      description: 'Modelled annual damages attributable to heatwaves, compared across countries.',
      label: 'Multi-country trajectories',
      legend: countryLegend,
      caseStudy: true,
    },
    {
      slug: 'adaptation-investments',
      short: 'Adaptation investments',
      title: 'Heat-adaptation investments (CLIMADA)',
      description: 'Where today’s heat stress meets the adaptation investment a country is projected to need, with each bubble sized by the population exposed.',
      label: 'Bubble chart: heat stress against investment',
      legend: ['Low current risk', 'Medium current risk', 'High current risk', 'Dot size = population exposed'],
      height: 'h-[460px]',
      caseStudy: true,
    },
  ];

  const sections = charts.map(({ slug, short }) => ({ slug, title: short }));

  let contentRef;
  let activeSlug;
</script>

<ScoreboardLayout>
  <svelte:fragment slot="filters">
    {#each filtersBefore as { label, value }}
      <SelectionButton {label} buttonLabel={value} wrapperClass="min-w-[10rem]" buttonClass="mt-1 text-sm" />
    {/each}
    <ScenarioSelection scenarios={$SCENARIOS} multiple={false} wrapperClass="min-w-[10rem]" labelClass="" buttonClass="mt-1 text-sm" />
    {#each filtersAfter as { label, value }}
      <SelectionButton {label} buttonLabel={value} wrapperClass="min-w-[10rem]" buttonClass="mt-1 text-sm" />
    {/each}
  </svelte:fragment>

  <svelte:fragment slot="actions">
    <Button variant="outline" size="sm">
      <Compare class="h-4 w-4" />
      Compare
    </Button>
  </svelte:fragment>

  <svelte:fragment slot="visual">
    <ScoreboardMap bounds={europeBounds} height="h-[560px]" values={indicatorValues} classes={INDICATOR_CLASSES} />

    <!-- Overlays sit on the layout's relative visual band; the inner max-w-7xl
         keeps the panel on the same left edge as the content below. -->
    <div class="pointer-events-none absolute inset-0 mx-auto max-w-7xl px-6">
      <div class="pointer-events-auto absolute bottom-6 left-6">
        <MapLegendPanel title={scope} subtitle={indicator} scale={indicatorScale} labels={indicatorScaleLabels} />
      </div>
    </div>
    <div class="absolute inset-x-0 bottom-6 flex justify-center">
      <Button href="#{charts[0].slug}">
        View {hazard} charts
        <LinkArrow />
      </Button>
    </div>
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
    {#each charts as chart}
      <ScoreboardSection eyebrow={scope} slug={chart.slug} title={chart.title} description={chart.description} accent={activeSlug === chart.slug}>
        {#if chart.caseStudy && caseStudy}
          <a class="text-sm font-bold text-theme-base" href="/{PATH_ADAPTATION}/{caseStudy.slug}">
            See {placeholderGeography.label} case study <span class="font-normal">→</span>
          </a>
        {/if}
        <ChartPlaceholder label={chart.label} legend={chart.legend} height={chart.height ?? 'h-[360px]'} />
      </ScoreboardSection>
    {/each}
  </div>

  <div class="pb-16">
    <LinkSection geography={placeholderGeography} {caseStudy} />
  </div>
</ScoreboardLayout>
