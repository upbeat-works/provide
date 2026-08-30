<script>
  import ScoreboardLayout from '$lib/components/layouts/ScoreboardLayout.svelte';
  import ScoreboardSection from '$lib/components/layouts/ScoreboardSection.svelte';
  import SelectionButton from '$lib/components/controls/components/SelectionButton.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import CopyLink from '$lib/components/ui/CopyLink.svelte';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
  import Compare from '$lib/components/icons/Compare.svelte';
  import ScoreboardMap from './components/ScoreboardMap.svelte';
  import RankingPanel from './components/RankingPanel.svelte';
  import SectionIndex from './components/SectionIndex.svelte';
  import { PATH_DOCUMENTATION, PATH_EU_SCOREBOARD, PATH_PROJECTS } from '$config';

  // Scoreboard ranking view. Structure-only: there are no scoreboard endpoints
  // yet, so the controls, the map layers and the ranking below are placeholders
  // — what's real here is the layout and the explainer copy.
  const indicatorsHref = `/${PATH_PROJECTS}/${PATH_EU_SCOREBOARD}/indicators`;
  const hazard = 'Heat Stress';

  // Whole of Europe, unlike the indicators view which frames a single country.
  const europeBounds = [-24, 34, 42, 68];

  const filters = [
    { label: 'Hazard/Sector', value: hazard },
    { label: 'Scenario', value: '2020 climate policies', colors: ['#51A6D3'] },
    { label: 'Year', value: '2025' },
  ];

  const ranking = [
    { rank: 1, label: 'Italy', value: 88 },
    { rank: 2, label: 'Spain', value: 87 },
    { rank: 3, label: 'France', value: 82 },
    { rank: 4, label: 'Czechia', value: 76 },
    { rank: 5, label: 'United Kingdom', value: 74 },
  ].map((entry) => ({ ...entry, href: indicatorsHref }));

  // The index reads differently from the headings — the last section's heading
  // names the hazard, the index just promises more data — so it's written out
  // rather than scraped from the h2s.
  const sections = [
    { slug: 'what-the-scoreboard-shows', title: 'What the scoreboard shows' },
    { slug: 'how-the-score-is-built', title: 'How the score is built' },
    { slug: 'scenarios-explained', title: 'Scenarios explained' },
    { slug: 'indicators', title: 'More data available' },
  ];

  // Tag colours: grass/sky/orange come from the palette; there is no red token,
  // so the high pathway borrows the map scale's red.
  const scenarios = [
    {
      tag: 'Reference',
      tagClass: 'bg-grass-100 text-grass-800',
      title: '2020 climate policies',
      description: 'Where the climate policies in force in 2020 lead if nothing further changes. The comparison case for every other pathway.',
    },
    {
      tag: 'Low',
      tagClass: 'bg-sky-200 text-sky-800',
      title: 'SSP1-2.6',
      description: 'Strong, early mitigation. Emissions fall quickly from the 2020s and warming is held close to the Paris range.',
    },
    {
      tag: 'Mid',
      tagClass: 'bg-orange-200 text-orange-800',
      title: 'SSP2-4.5',
      description: 'Middle of the road. Emissions peak around mid-century, then decline slowly. Current trends extended.',
    },
    {
      tag: 'High',
      tagClass: 'bg-[#F7DAD9] text-[#C91C1C]',
      title: 'SSP5-8.5',
      description: 'Fossil-fuelled development. The highest pathway, used as an upper bound rather than a likely future.',
    },
  ];

  const indicators = [
    'Annual maximum temperature',
    'Annual mean temperature (MESMER)',
    'Days above 30 °C',
    'Tropical nights',
    'Heatwave duration',
    'Cooling degree days',
    'Population exposed to extreme heat',
  ];

  let contentRef;
  let activeSlug;
</script>

<ScoreboardLayout>
  <svelte:fragment slot="filters">
    {#each filters as { label, value, colors }}
      <SelectionButton {label} buttonLabel={value} {colors} wrapperClass="min-w-[10rem]" buttonClass="mt-1 text-sm" />
    {/each}
  </svelte:fragment>

  <svelte:fragment slot="actions">
    <Button variant="outline" size="sm">
      <Compare class="h-4 w-4" />
      Compare
    </Button>
  </svelte:fragment>

  <svelte:fragment slot="visual">
    <ScoreboardMap bounds={europeBounds} height="h-[560px]" />

    <!-- Overlays sit on the layout's relative visual band; the inner max-w-7xl
         keeps the panel on the same left edge as the content below, and it is
         anchored to the foot of the map so it grows upwards as rows are added. -->
    <div class="pointer-events-none absolute inset-0 mx-auto max-w-7xl px-6">
      <div class="pointer-events-auto absolute bottom-6 left-6">
        <RankingPanel {hazard} entries={ranking} />
      </div>
    </div>
    <div class="absolute inset-x-0 bottom-6 flex justify-center">
      <Button href="#{sections[0].slug}">
        How to read this scoreboard
        <span class="inline-flex rotate-90"><LinkArrow /></span>
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
    <ScoreboardSection
      eyebrow="Scoreboard"
      slug="what-the-scoreboard-shows"
      title="What the scoreboard shows"
      description="A single, comparable picture of climate risk across Europe. Countries are ranked for the hazard, scenario and year you select, so the view answers one question: where is risk highest?"
      accent={activeSlug === 'what-the-scoreboard-shows'}
    />

    <ScoreboardSection
      eyebrow="Method"
      slug="how-the-score-is-built"
      title="How the score is built"
      description="Each country receives a composite score from 0 to 100 for the selected hazard. The score combines that hazard's underlying indicators into one number so countries can be placed on the same scale."
      accent={activeSlug === 'how-the-score-is-built'}
    >
      <div class="max-w-3xl rounded bg-theme-50 px-5 py-4">
        <p class="text-sm font-semibold text-theme-stronger">Scores and indicator values are different scales</p>
        <p class="mt-1 text-sm text-text-weaker">The 0–100 score only exists here. Under Explore indicators you see raw values such as ΔT °C. The two are not directly comparable.</p>
      </div>
    </ScoreboardSection>

    <ScoreboardSection
      eyebrow="Pathways"
      slug="scenarios-explained"
      title="Scenarios explained"
      description="Every view is tied to one scenario. Switching scenario changes the assumptions about future emissions, not the way the score is calculated."
      accent={activeSlug === 'scenarios-explained'}
    >
      <div class="grid max-w-3xl gap-4 sm:grid-cols-2">
        {#each scenarios as { tag, tagClass, title, description }}
          <div class="flex flex-col gap-2 rounded border border-contour-weakest p-5">
            <span class="self-start rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide {tagClass}">{tag}</span>
            <h3 class="text-lg leading-tight text-theme-stronger">{title}</h3>
            <p class="text-sm leading-relaxed text-text-weaker">{description}</p>
          </div>
        {/each}
      </div>
    </ScoreboardSection>

    <ScoreboardSection
      eyebrow="Indicators"
      slug="indicators"
      title="{hazard} indicators for Europe and individual countries"
      description="The scoreboard compares countries on one score. To see the indicators behind that score, and how each one changes over time, switch to Explore indicators and choose Europe or a single country."
      accent={activeSlug === 'indicators'}
      divider={false}
    >
      <ul class="flex max-w-3xl flex-wrap gap-2">
        {#each indicators as indicator}
          <li class="flex items-center gap-2 rounded-full bg-surface-weaker px-3 py-1.5 text-sm text-text-weaker">
            <span class="h-1.5 w-1.5 rounded-full bg-contour-weaker" />
            {indicator}
          </li>
        {/each}
      </ul>

      <div class="mt-4 flex flex-wrap items-center gap-4">
        <Button href={indicatorsHref}>
          Explore {hazard} indicators
          <LinkArrow />
        </Button>
        <p class="text-sm text-text-weaker">or select any country in the ranking to open it directly</p>
      </div>
    </ScoreboardSection>
  </div>
</ScoreboardLayout>
