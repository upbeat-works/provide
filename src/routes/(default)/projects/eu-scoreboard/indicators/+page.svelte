<script>
  import ScoreboardLayout from '$lib/components/layouts/ScoreboardLayout.svelte';
  import ScoreboardSection from '$lib/components/layouts/ScoreboardSection.svelte';
  import ScenarioSelection from '$lib/components/controls/ScenarioSelection/ScenarioSelection.svelte';
  import FilterSelect from '../components/FilterSelect.svelte';
  import IndicatorSelection from '$lib/components/controls/IndicatorSelection.svelte';
  import { CURRENT_INDICATOR, CURRENT_SCENARIOS } from '$stores/state.js';
  import { sortBy } from 'lodash-es';
  import Button from '$lib/components/ui/Button.svelte';
  import CopyLink from '$lib/components/ui/CopyLink.svelte';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
  import CompareMenu from '../components/CompareMenu.svelte';
  import ScoreboardMap from '../components/ScoreboardMap.svelte';
  import MapLegendPanel from '../components/MapLegendPanel.svelte';
  import SectionIndex from '../components/SectionIndex.svelte';
  import LinkSection from '../../../impacts/explore/components/ImpactGeo/LinkSection.svelte';
  import { legendOf } from '../components/choropleth.js';
  import { coveredGeoIds, INDICATOR_CLASSES, indicatorValuesFor } from '../components/scores.js';
  import { DEFAULT_YEAR, YEARS } from '../components/filters.js';
  import { comparisonViews, seedComparison } from '../components/comparison.js';
  import { charts, dataParamsFor, graphParamsFor, DOWNLOAD_ENDPOINT, EMBED_UID } from '../components/charts/catalog.js';
  import { findCaseStudy } from '$lib/catalog/case-study-link.js';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { replaceState } from '$app/navigation';
  import { PATH_ADAPTATION, PATH_DOCUMENTATION, URL_PATH_GEOGRAPHY } from '$config';
  import { loadIndicatorIndex } from '$utils/apis.js';
  import { createOwnedIndicatorIndexRequest } from '$stores/owned-indicator-index.js';

  export let data;
  const ownedIndicatorIndex = createOwnedIndicatorIndexRequest({
    initialIndex: data.indicatorIndex,
    load: () => loadIndicatorIndex(fetch),
  });
  const indicatorIndexRequest = ownedIndicatorIndex.state;

  function retryIndicatorIndex() {
    void ownedIndicatorIndex.retry();
  }

  const hazard = 'Heat Stress';
  // What the map's placeholder values stand for, until the scoreboard has its
  // own data: the legend names the selected indicator once there is one.
  const placeholderIndicator = 'Annual Maximum Temperature';
  $: indicator = $CURRENT_INDICATOR?.label ?? placeholderIndicator;

  // Whole of Europe, matching the ranking view's frame.
  const europeBounds = [-24, 34, 42, 68];

  // The country list is the real geography catalog, narrowed to the countries
  // the scoreboard has values for — offering one the map cannot colour would be
  // a promise the view can't keep. `geography` undefined means all of them.
  const covered = new Set(coveredGeoIds);
  $: countries = sortBy(
    (data.geographies.admin0 ?? []).filter(({ geoId }) => covered.has(geoId)),
    'label'
  );

  let geography;
  let year = DEFAULT_YEAR;
  $: scenario = $CURRENT_SCENARIOS[0];

  // The country lives in the URL, so a link from the ranking view (or from this
  // view's own map) opens already scoped to it, and "Copy link to these
  // results" carries the selection. Read once the catalog is in — the geo id in
  // the link has to be resolved against the country list.
  let readUrl = false;
  $: if (!readUrl && countries.length) {
    readUrl = true;
    const geoId = $page.url.searchParams.get(URL_PATH_GEOGRAPHY);
    if (geoId) geography = countries.find((country) => country.geoId === geoId);
  }

  // Written back with replaceState rather than goto: this is the same view with
  // a different country, so it should neither re-run the page's load nor leave
  // a history entry per dropdown click.
  $: if (readUrl && browser) writeUrl(geography);

  function writeUrl(selected) {
    const url = new URL($page.url);
    if (selected?.geoId) url.searchParams.set(URL_PATH_GEOGRAPHY, selected.geoId);
    else url.searchParams.delete(URL_PATH_GEOGRAPHY);
    if (url.href !== $page.url.href) replaceState(url, $page.state);
  }

  // A country on the map is the same choice as the one in the filter bar —
  // except while comparing geographies, where each map is choosing for its own
  // side.
  function selectFromMap(geoId, side) {
    const match = countries.find((country) => country.geoId === geoId);
    if (!match) return;
    if (compareBy?.uid === 'geography') sides[side] = match;
    else geography = match;
  }

  // A comparison lifts one dimension out of the filter bar and gives each map
  // its own selector for it; everything else stays shared.
  const dimensions = [
    { uid: 'scenario', label: 'Scenario' },
    { uid: 'year', label: 'Year' },
    { uid: 'geography', label: 'Geography' },
  ];
  let compareBy;
  // The compared dimension's value per map. Two entries; only read while
  // comparing.
  let sides = [];

  const optionsFor = (uid) => ({ scenario: data.scenarios, year: YEARS, geography: countries })[uid] ?? [];
  const valueFor = (uid) => ({ scenario, year, geography })[uid];

  // Seed only when the compared dimension changes. `sides` must not be read
  // here: this statement would then depend on it, and choosing a value on a map
  // would re-seed the pair straight back to what it opened with.
  let seededFor;
  $: if (compareBy?.uid !== seededFor) {
    seededFor = compareBy?.uid;
    sides = compareBy ? seedComparison(optionsFor(compareBy.uid), valueFor(compareBy.uid)) : [];
  }

  $: views = comparisonViews(compareBy?.uid, sides, { geography, year, scenario });

  // The legend card names the whole selection so two maps say what makes them
  // different, with the compared part picked out.
  const legendParts = (view, compared) => [
    { label: view.geography?.label ?? 'All countries', accent: compared === 'geography' },
    { label: view.scenario?.label ?? 'No scenario', accent: compared === 'scenario' },
    { label: String(view.year?.label ?? ''), accent: compared === 'year' },
  ];

  // The geography selector needs its search and its "everything" row wherever it
  // is shown; the others are plain lists.
  $: compareSelectProps = compareBy?.uid === 'geography' ? { allLabel: 'All available countries', buttonAllLabel: 'All countries', placeholder: 'Search geography' } : {};

  // Everything that names what is on screen follows the selection: the section
  // eyebrows, the map's legend card, and the country the map outlines.
  $: scope = compareBy?.uid === 'geography' ? views.map(({ geography: g }) => g?.label ?? 'All countries').join(' vs ') : geography?.label ?? 'Europe';

  // Sequential ramp for a single indicator, where the ranking view's map runs a
  // diverging risk scale. Palette oranges, low to high — the map's own classes,
  // so the legend can't drift from what is drawn.
  const { scale: indicatorScale, labels: indicatorScaleLabels } = legendOf(INDICATOR_CLASSES);

  // Stands in for the selected geography until the scoreboard has a selection;
  // findCaseStudy falls back to the default study when nothing covers it.
  const placeholderGeography = { label: 'Lisbon', uid: 'lisbon' };
  $: caseStudy = findCaseStudy(data.caseStudies, placeholderGeography);

  // The charts themselves live in the catalog beside their components, so the
  // embed route can draw the same chart the graph download was asked for.
  // The series are placeholders (see `series.js`); the charts around them are not.

  const sections = charts.map(({ slug, short }) => ({ slug, title: short }));

  let contentRef;
  let activeSlug;
</script>

<ScoreboardLayout>
  <svelte:fragment slot="filters">
    {#if compareBy?.uid !== 'geography'}
      <FilterSelect label="Geography" options={countries} bind:selected={geography} allLabel="All available countries" buttonAllLabel="All countries" placeholder="Search geography" />
    {/if}
    <!-- The scoreboard scopes itself by its own geography, so the modal offers
         the whole indicator catalog rather than explore's per-region list. -->
    <IndicatorSelection indicatorIndexRequest={$indicatorIndexRequest} {retryIndicatorIndex} wrapperClass="min-w-[10rem]" labelClass="" buttonClass="mt-1 text-sm" />
    {#if compareBy?.uid !== 'scenario'}
      <ScenarioSelection scenarios={data.scenarios} multiple={false} wrapperClass="min-w-[10rem]" labelClass="" buttonClass="mt-1 text-sm" />
    {/if}
    {#if compareBy?.uid !== 'year'}
      <FilterSelect label="Year" options={YEARS} bind:selected={year} />
    {/if}
  </svelte:fragment>

  <svelte:fragment slot="actions">
    <CompareMenu {dimensions} bind:selected={compareBy} />
  </svelte:fragment>

  <svelte:fragment slot="visual">
    <!-- Keyed on the number of maps: a mapbox instance does not re-fit when its
         container is resized under it, so splitting the band has to build the
         maps afresh rather than squeeze the existing one into half the width. -->
    {#key views.length}
      <div class="flex" class:gap-px={compareBy}>
        {#each views as view, i (i)}
          <div class="relative min-w-0 flex-1">
            <ScoreboardMap
              bounds={europeBounds}
              height="h-[560px]"
              values={indicatorValuesFor(view)}
              classes={INDICATOR_CLASSES}
              highlight={view.geography?.geoId}
              selectable={true}
              on:select={({ detail }) => selectFromMap(detail.uid, i)}
            />

            <!-- Overlays sit on the map they belong to. With one map the inner
                 max-w-7xl keeps the card on the same left edge as the content
                 below; side by side, each card belongs to its own half. -->
            <div class="pointer-events-none absolute inset-0 {compareBy ? '' : 'mx-auto max-w-7xl px-6'}">
              {#if compareBy}
                <div class="pointer-events-auto absolute left-6 top-6">
                  <FilterSelect
                    label={compareBy.label}
                    options={optionsFor(compareBy.uid)}
                    bind:selected={sides[i]}
                    labelClass="sr-only"
                    wrapperClass="min-w-[12rem]"
                    buttonClass="rounded border border-contour-weakest bg-surface-base px-3 py-2 text-sm shadow-sm"
                    {...compareSelectProps}
                  />
                </div>
              {/if}
              <div class="pointer-events-auto absolute bottom-6 left-6">
                <MapLegendPanel parts={legendParts(view, compareBy?.uid)} subtitle={indicator} scale={indicatorScale} labels={indicatorScaleLabels} />
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/key}

    {#if !compareBy}
      <div class="absolute inset-x-0 bottom-6 flex justify-center">
        <Button href="#{charts[0].slug}">
          View {hazard} charts
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
    {#each charts as chart}
      <ScoreboardSection eyebrow={scope} slug={chart.slug} title={chart.title} description={chart.description} accent={activeSlug === chart.slug}>
        {#if chart.caseStudy && caseStudy}
          <a class="text-sm font-bold text-theme-base" href="/{PATH_ADAPTATION}/{caseStudy.slug}">
            See {placeholderGeography.label} case study <span class="font-normal">→</span>
          </a>
        {/if}
        <!-- The caption row is explore's: the chart's own info, a graph
             download that screenshots this chart's embed, and a data download
             carrying the current selection. -->
        <svelte:component
          this={chart.component}
          {...chart.props}
          chartInfo={chart.info}
          chartUid={EMBED_UID}
          graphDownloadParams={graphParamsFor(chart)}
          dataDownloadEndpoint={DOWNLOAD_ENDPOINT}
          dataDownloadOptions={chart.downloadOptions}
          dataDownloadParams={dataParamsFor(chart, { geography, scenario, year })}
        />
      </ScoreboardSection>
    {/each}
  </div>

  <div class="pb-16">
    <LinkSection geography={placeholderGeography} {caseStudy} />
  </div>
</ScoreboardLayout>
