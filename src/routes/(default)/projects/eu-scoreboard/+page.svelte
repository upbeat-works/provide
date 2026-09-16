<script>
  import ScoreboardLayout from '$lib/components/layouts/ScoreboardLayout.svelte';
  import ScoreboardSection from '$lib/components/layouts/ScoreboardSection.svelte';
  import ScoreboardMap from './components/ScoreboardMap.svelte';
  import RankingPanel from './components/RankingPanel.svelte';
  import SectorSelect from './components/SectorSelect.svelte';
  import SectionIndex from './components/SectionIndex.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import CopyLink from '$lib/components/ui/CopyLink.svelte';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { PATH_DOCUMENTATION, PATH_EU_SCOREBOARD, PATH_PROJECTS } from '$config';
  import { isChartVisible } from './components/charts/adapter.js';
  import { RISK_CLASSES, riskRankingFor, riskValuesFor } from './components/scores.js';

  export let data;

  const europeBounds = [-24, 34, 42, 68];
  const sections = [
    { slug: 'what-the-scoreboard-shows', title: 'What the scoreboard shows' },
    { slug: 'how-the-score-is-built', title: 'How the score is built' },
    { slug: 'scenarios-explained', title: 'Scenarios explained' },
    { slug: 'indicators', title: 'More data available' },
  ];
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
    'Annual Maximum Temperature',
    'Annual Mean Temperature (MESMER)',
    'Days Above 30 °C',
    'Tropical Nights',
    'Heatwave Duration',
    'Cooling Degree Days',
    'Population Exposed to Extreme Heat',
  ];
  let contentRef;
  let activeSlug;
  $: hazard = data.scoreboard.sector.label;
  $: chartResults = (data.charts ?? []).filter((result) => isChartVisible(result, data.selection));
  $: indicatorsHref = `/${PATH_PROJECTS}/${PATH_EU_SCOREBOARD}/indicators?${selectionParams()}`;
  $: rankingView = { scenario: data.selection?.scenario, year: data.selection?.year };
  $: mapValues = riskValuesFor(rankingView);
  $: rankingEntries = riskRankingFor(rankingView).slice(0, 5).map((entry) => ({ ...entry, href: countryHref(entry.label) }));
  $: rankingParts = [
    { label: data.selection?.scenario?.label ?? 'No scenario' },
    { label: data.selection?.year?.label ?? 'No year' },
  ];

  function selectionParams(region) {
    const params = new URLSearchParams({ sector: data.scoreboard.sector.uid });
    for (const key of ['scenario', 'region', 'year']) {
      let value = data.selection?.[key]?.uid;
      if (key === 'region' && region) value = region;
      if (value !== undefined && value !== null) params.set(key, value);
    }
    return params;
  }

  const countryHref = (label) => `/${PATH_PROJECTS}/${PATH_EU_SCOREBOARD}/indicators?${selectionParams(label)}`;

  function selectCountry(uid) {
    const country = mapValues.find((entry) => entry.uid === uid);
    if (country) void goto(countryHref(country.label));
  }

  function select(key, event) {
    const url = new URL($page.url);
    url.searchParams.set(key, event.currentTarget.value);
    void goto(url, { keepFocus: true, noScroll: true });
  }
</script>

<ScoreboardLayout>
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
    <ScoreboardMap bounds={europeBounds} height="h-[560px]" values={mapValues} classes={RISK_CLASSES} selectable={true} on:select={({ detail }) => selectCountry(detail.uid)} />
    <div class="pointer-events-none absolute inset-0 mx-auto max-w-7xl px-6">
      <div class="pointer-events-auto absolute bottom-6 left-6">
        <p class="mb-2 text-sm font-semibold">Mock data</p>
        <RankingPanel parts={rankingParts} {hazard} entries={rankingEntries} />
      </div>
    </div>
    <div class="absolute inset-x-0 bottom-6 flex justify-center">
      <Button href={`#${sections[0].slug}`}>
        How to read this scoreboard
        <span class="inline-flex rotate-90"><LinkArrow /></span>
      </Button>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="sidebar">
    <SectionIndex {sections} {contentRef} bind:activeSlug />
    <div class="mt-8 flex flex-col items-start gap-5">
      <CopyLink />
      <Button href={`/${PATH_DOCUMENTATION}`} variant="secondary" class="w-full justify-between text-left">
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
      title={`${hazard} indicators for Europe and individual countries`}
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

      {#if chartResults.length}
        <ul class="mt-6 flex max-w-3xl flex-col gap-3">
          {#each chartResults as result (result.definition.chartId)}
            <li>
              <a class="font-semibold text-theme-base" href={`${indicatorsHref}#${result.definition.chartId}`}>{result.definition.title}</a>
              {#if result.status === 'error'}<span class="ml-2 text-sm text-text-weaker">Data could not be loaded</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}

      <div class="mt-4 flex flex-wrap items-center gap-4">
        <Button href={indicatorsHref}>Explore {hazard} indicators <LinkArrow /></Button>
        <p class="text-sm text-text-weaker">or select any country in the ranking to open it directly</p>
      </div>
    </ScoreboardSection>
  </div>
</ScoreboardLayout>
