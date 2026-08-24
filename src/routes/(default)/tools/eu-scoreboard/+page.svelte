<script>
  import ScoreboardLayout from '$lib/components/layouts/ScoreboardLayout.svelte';
  import ScoreboardSection from '$lib/components/layouts/ScoreboardSection.svelte';
  import SelectionButton from '$lib/components/controls/components/SelectionButton.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
  import Compare from '$lib/components/icons/Compare.svelte';
  import Link from '$lib/components/icons/Link.svelte';
  import ScoreboardMap from './components/ScoreboardMap.svelte';
  import ChartPlaceholder from './components/ChartPlaceholder.svelte';
  import TimelineStrip from './components/TimelineStrip.svelte';
  import LinkSection from '../../impacts/explore/components/ImpactGeo/LinkSection.svelte';
  import { findCaseStudy } from '$lib/catalog/case-study-link.js';

  export let data;

  // Structure-only page: every control and chart below is a placeholder. There
  // are no scoreboard endpoints yet, so nothing reads from a store or a loader
  // — the point here is the layout (ScoreboardLayout / ScoreboardSection).
  // Stands in for the selected geography until the scoreboard has a selection;
  // findCaseStudy falls back to the default study when nothing covers it.
  const placeholderGeography = { label: 'Austria', uid: 'austria' };
  $: caseStudy = findCaseStudy(data.caseStudies, placeholderGeography);

  const filters = [
    { label: 'Geography', value: 'Austria' },
    { label: 'Hazard/Sector', value: 'Heat Stress' },
    { label: 'Indicator', value: 'Annual max temp' },
    { label: 'Scenario', value: '2020 climate policies' },
    { label: 'Year', value: '2025' },
  ];
</script>

<ScoreboardLayout
  title="EU Scoreboard"
  description="Explore how different scenarios change climate risk across European countries and regions. See where impacts are most likely to exceed key thresholds, and compare outcomes over time to identify hotspots and more resilient pathways."
>
  <img slot="brand" src="/img/sparccle-logo-white.svg" alt="SPARCCLE" class="h-8 w-auto" />

  <svelte:fragment slot="filters">
    {#each filters as { label, value }}
      <SelectionButton {label} buttonLabel={value} wrapperClass="min-w-[10rem]" buttonClass="mt-1 text-sm" />
    {/each}
  </svelte:fragment>

  <svelte:fragment slot="actions">
    <Button variant="outline" size="sm">
      <Compare class="h-4 w-4" />
      Compare
    </Button>
    <Button variant="outline" size="sm">
      <Link class="h-3.5 w-3.5" />
      Share
    </Button>
  </svelte:fragment>

  <svelte:fragment slot="visual">
    <ScoreboardMap />
  </svelte:fragment>

  <svelte:fragment slot="timeline">
    <TimelineStrip />
  </svelte:fragment>

  <ScoreboardSection
    slug="baseline-comparison"
    title="How does 2025 compare to a historical baseline?"
    description="Showing observed historical values alongside the projected 2025 figure tells you whether you're already in anomalous territory or still within past variability."
  >
    <ChartPlaceholder label="Stacked bar chart by region" legend={['Base – SSP1-2.6', 'up to SSP2-4.5', 'up to SSP5-8.5']} height="h-[360px]" />
  </ScoreboardSection>

  <ScoreboardSection
    slug="scenario-trajectories"
    title="How does 2025 compare to a historical baseline?"
    description="Showing observed historical values alongside the projected 2025 figure tells you whether you're already in anomalous territory or still within past variability."
  >
    <ChartPlaceholder label="Scenario trajectories over time" legend={['SSP5 uncertainty band', 'SSP5-8.5 (high)', 'SSP2-4.5 (mid)', 'SSP1-2.6 (low)']} height="h-[360px]" />
  </ScoreboardSection>

  <ScoreboardSection
    slug="exceedance-probability"
    title="Exceedance probability by scenario"
    description="For a given temperature threshold, this chart shows the probability that Austria's annual maximum temperature will exceed it in the selected year under each scenario. The vertical lines mark planning-relevant thresholds — for example health system stress at 35°C or infrastructure design limits at 38°C. Reading across at any threshold immediately shows how much scenario choice changes the risk of crossing it."
    divider={false}
  >
    <ChartPlaceholder label="Exceedance probability curves" legend={['SSP5-8.5 (high)', 'SSP2-4.5 (mid)', 'SSP1-2.6 (low)', 'Design thresholds']} height="h-[360px]" />
  </ScoreboardSection>

  <Button slot="footer-aside" href="/methodology" variant="secondary">
    Learn more about the methodology
    <LinkArrow />
  </Button>

  <div slot="footer">
    <LinkSection geography={placeholderGeography} {caseStudy} />
  </div>
</ScoreboardLayout>
