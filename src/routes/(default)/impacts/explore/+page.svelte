<script>
  import ImpactTime from './components/ImpactTime/ImpactTime.svelte';
  import ImpactGeo from './components/ImpactGeo/ImpactGeo.svelte';
  import UnAvoidableRisk from '../components/UnavoidableRisk/UnavoidableRisk.svelte';
  import ScenarioSelection from '$lib/components/controls/ScenarioSelection/ScenarioSelection.svelte';
  import {
    IS_COMBINATION_AVAILABLE,
    IS_EMPTY_SELECTION,
    CURRENT_GEOGRAPHY,
    CURRENT_INDICATOR,
    CURRENT_INDICATOR_OPTION_VALUES,
    CURRENT_SCENARIOS,
    MAP_CHART_VIEW,
    WARMING_CHART_VIEW,
    TEMPLATE_PROPS,
    DOWNLOAD_URL_PARAMS,
    PERCENTILE_SCENARIO_AVAILABILITY_REQUEST,
    ACTIVE_INDICATOR_SCOPE_REQUEST,
    ACTIVE_INDICATOR_SCOPE_CONTEXT,
    AVAILABLE_IMPACT_GEO_YEARS,
    SELECTABLE_WARMING_SCENARIOS,
    CURRENT_INDICATOR_UNIT_UID,
  } from '$stores/state';
  import VisData from '$lib/components/icons/VisData.svelte';
  import { PATH_AVOID, GEOGRAPHY_TYPE_CITY } from '$config';
  import FallbackMessage from '$lib/components/ui/FallbackMessage.svelte';
  import ParameterSelection from '$lib/components/controls/ParameterSelection.svelte';
  import ModeSelectionTabs from '$lib/components/controls/ModeSelectionTabs.svelte';
  import IndicatorFilters from './components/IndicatorFilters.svelte';
  import PageHero from '$lib/components/layouts/PageHero.svelte';
  import PageLayout from '$lib/components/layouts/PageLayout.svelte';
  import SimpleNav from '$lib/components/navigation/SimpleNav.svelte';
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import { pushState, replaceState } from '$app/navigation';
  import { createScrollSpy } from '$lib/utils/scrollSpy';
  import { toLegacyAvoidIndicatorUid } from '$lib/catalog/translate.js';
  import { findCaseStudy } from '$lib/catalog/case-study-link.js';
  import ShareLink from '../components/ShareLink/ShareLink.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
  import LinkSection from './components/ImpactGeo/LinkSection.svelte';
  import { catalogFlow } from '$stores/catalog-flow.js';
  import { runtimeCatalog } from '$stores/runtime-catalog.js';
  import { parseCatalogUrlSelection } from '$lib/utils/url.js';
  import { RUNTIME_CATALOG_SELECTION } from '$stores/state.js';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import { initializeExplore } from './explore-initialization.js';
  import { createExploreUrlSync } from './explore-url-sync.js';
  import { percentileChartView, retryPercentileChartRequest, scenariosForTimeframe } from '$stores/catalog-adapters.js';
  import { retryWarmingChartRequest } from '$stores/catalog-adapters.js';
  import { withScenarioTimeframe } from '$lib/utils/utils.js';
  import { KEY_SCENARIO_ENDYEAR } from '$config';

  export let data;

  $: isValidSelection = !$IS_EMPTY_SELECTION && $IS_COMBINATION_AVAILABLE;

  $: avoidIsCity = $CURRENT_GEOGRAPHY?.geographyType === GEOGRAPHY_TYPE_CITY;
  $: avoidIndicator = toLegacyAvoidIndicatorUid($CURRENT_INDICATOR?.uid);
  $: avoidAvailable = isValidSelection && avoidIsCity && !!avoidIndicator;
  $: avoidHref = `/impacts/${PATH_AVOID}`;
  $: if (avoidAvailable) {
    const params = new URLSearchParams({
      geography: $CURRENT_GEOGRAPHY.uid,
      indicator: $CURRENT_INDICATOR.uid,
      instance: $CURRENT_INDICATOR.instance,
    });
    avoidHref = `/impacts/${PATH_AVOID}?${params}`;
  }

  let initialization = { status: 'loading' };
  let initializationRevision = 0;
  let mounted = false;
  let urlSync;

  onMount(() => {
    mounted = true;
    urlSync = createExploreUrlSync({
      selectionStore: runtimeCatalog.selection,
      getUrl: () => new URL(window.location.href),
      getPageState: () => $page.state,
      push: pushState,
      replace: replaceState,
      restore: (sourceUrl) => initializeCatalog({ sourceUrl }),
      events: window,
    });
    void retryInitialization();
    return () => {
      mounted = false;
      initializationRevision += 1;
      urlSync.destroy();
    };
  });

  async function initializeCatalog({ sourceUrl = new URL(window.location.href) } = {}) {
    const revision = ++initializationRevision;
    initialization = { status: 'loading' };
    const pending = parseCatalogUrlSelection(sourceUrl);
    const result = await initializeExplore({
      pending,
      catalog: runtimeCatalog,
      flow: catalogFlow,
      requestFetch: fetch,
      isCurrent: () => mounted && revision === initializationRevision,
    });
    if (!mounted || revision !== initializationRevision) return false;
    initialization = result.status === 'cancelled' ? { status: 'ready' } : result;
    return initialization.status === 'ready';
  }

  async function retryInitialization() {
    const ready = await initializeCatalog();
    if (ready) urlSync?.ready();
  }

  $: caseStudy = findCaseStudy(data.caseStudies, $CURRENT_GEOGRAPHY);

  $: impactTimeView = percentileChartView({
    combinationAvailable: $IS_COMBINATION_AVAILABLE,
    availability: $PERCENTILE_SCENARIO_AVAILABILITY_REQUEST,
    indicatorScopeRequest: $ACTIVE_INDICATOR_SCOPE_REQUEST,
    indicatorScopeContext: $ACTIVE_INDICATOR_SCOPE_CONTEXT,
    selection: $RUNTIME_CATALOG_SELECTION,
  });
  $: sharedChartContext = {
    ...$TEMPLATE_PROPS,
    geography: $CURRENT_GEOGRAPHY,
    indicator: $CURRENT_INDICATOR,
    scenarios: $CURRENT_SCENARIOS,
    parameters: $CURRENT_INDICATOR_OPTION_VALUES,
    urlParams: $DOWNLOAD_URL_PARAMS,
    static: false,
  };
  $: impactTimeContext = { ...sharedChartContext, view: impactTimeView };
  $: impactGeoContext = {
    ...sharedChartContext,
    view: $MAP_CHART_VIEW,
    availableYears: $AVAILABLE_IMPACT_GEO_YEARS,
  };
  $: warmingScenarios = withScenarioTimeframe(
    $CURRENT_SCENARIOS.map(({ uid, label, color, [KEY_SCENARIO_ENDYEAR]: timeframe }) => ({ uid, label, color, [KEY_SCENARIO_ENDYEAR]: timeframe })),
    $SELECTABLE_WARMING_SCENARIOS,
    KEY_SCENARIO_ENDYEAR
  );
  $: warmingContext = {
    ...sharedChartContext,
    view: $WARMING_CHART_VIEW,
    scenarios: warmingScenarios,
    allScenarios: scenariosForTimeframe({ selectedScenarios: warmingScenarios, allScenarios: $SELECTABLE_WARMING_SCENARIOS }),
    unitUid: $CURRENT_INDICATOR_UNIT_UID,
  };

  function retryImpactTimeAvailability() {
    return retryPercentileChartRequest({ view: impactTimeView, flow: catalogFlow, indicatorScopeContext: $ACTIVE_INDICATOR_SCOPE_CONTEXT });
  }

  function retryMapAvailability() {
    return retryPercentileChartRequest({ view: $MAP_CHART_VIEW, flow: catalogFlow, indicatorScopeContext: $ACTIVE_INDICATOR_SCOPE_CONTEXT });
  }

  function retryWarmingAvailability() {
    return retryWarmingChartRequest({ view: $WARMING_CHART_VIEW, flow: catalogFlow, indicatorScopeContext: $ACTIVE_INDICATOR_SCOPE_CONTEXT });
  }

  $: sections = [
    {
      slug: 'impact-time',
      title: 'Timing',
      description: 'How will this climate impact change?',
      component: ImpactTime,
      disabled: !isValidSelection,
      props: { tagline: 'Timing', chartContext: impactTimeContext, retryAvailability: retryImpactTimeAvailability },
    },
    $MAP_CHART_VIEW.status === 'empty' ? null : {
      slug: 'impact-geo',
      title: 'Location',
      description: 'Where will impacts hit the hardest?',
      component: ImpactGeo,
      disabled: !isValidSelection,
      props: { tagline: 'Location', chartContext: impactGeoContext, retryAvailability: retryMapAvailability },
    },
    $WARMING_CHART_VIEW.status === 'empty' ? null : {
      slug: 'unavoidable-risk',
      title: '(Un)avoidable risk',
      description: 'What can be avoided through emissions reductions?',
      component: UnAvoidableRisk,
      disabled: !isValidSelection,
      props: { tagline: '(Un)avoidable risk', chartContext: warmingContext, retryAvailability: retryWarmingAvailability },
    },
    { component: FallbackMessage, disabled: isValidSelection },
  ].filter(Boolean);

  let activeIndex = 0;
  let contentEl;
  let spy = null;

  $: if (contentEl) {
    spy?.destroy();
    spy = createScrollSpy(contentEl, {
      getItems: () => sections.map((s) => (s.slug && !s.disabled ? document.getElementById(s.slug) : null)),
      onActive: (i) => {
        activeIndex = i;
      },
    });
  }

  function handleNavClick(i) {
    spy?.click(i);
  }

  onDestroy(() => spy?.destroy());
</script>

<PageLayout>
  <svelte:fragment slot="hero">
    <PageHero
      label="EXPLORER"
      title="Future impacts"
      description="Explore how different levels of climate action will lead to different climate impacts for countries, cities, and more. See where risk escalates and under what conditions impacts could be avoided."
    />
    <div class="bg-slate-50 pt-8">
      <div class="mx-auto max-w-7xl px-6">
        <ModeSelectionTabs />
      </div>
    </div>
    <hr class="border-t border-contour-weakest" />
  </svelte:fragment>

  <svelte:fragment slot="nav">
    <ParameterSelection />
    <div class="border-b border-contour-weakest" />
  </svelte:fragment>

  <svelte:fragment slot="sidebar">
    <SimpleNav {sections} {activeIndex} onNavClick={handleNavClick} />
    <hr class="my-4 border-contour-weakest mr-6" />
    <ShareLink />
    <Button class="mt-4 mr-6" href="/methodology" variant="secondary">
      Learn more about the methodology
      <LinkArrow />
    </Button>
    <Button class="mt-4 mr-6" href="/impacts/avoid" variant="secondary">
      Learn more about how to avoid future impacts
      <LinkArrow />
    </Button>
  </svelte:fragment>

  <svelte:fragment slot="filters">
    <ScenarioSelection />
    <IndicatorFilters />
  </svelte:fragment>

  <svelte:fragment slot="content">
    {#if initialization.status === 'loading'}
      <LoadingPlaceholder />
    {:else if initialization.status === 'failure'}
      <div class="py-16 text-center" role="alert">
        <p class="mb-4 text-sm text-text-weaker">{initialization.message}</p>
        <Button on:click={retryInitialization}>Retry</Button>
      </div>
    {:else}
      <div bind:this={contentEl}>
        {#each sections as section, i}
          {#if !section.disabled}
            <section id={section.slug} name={section.slug} class="scroll-mt-4 mb-8 pb-8 -mx-6 px-6 border-contour-weakest border-b last:border-none">
              <svelte:component this={section.component} {...section.props} />
            </section>
            {#if (section.slug === 'impact-geo' || ($MAP_CHART_VIEW.status === 'empty' && section.slug === 'impact-time')) && $CURRENT_GEOGRAPHY}
              <div class="mb-8 pb-8 -mx-6 px-6 border-b border-contour-weakest">
                <LinkSection geography={$CURRENT_GEOGRAPHY} {caseStudy} />
              </div>
            {/if}
          {/if}
        {/each}
        {#if avoidAvailable}
          <div class="flex justify-center">
            <Button href={avoidHref} variant="secondary" class="!px-8 !py-4 !text-base !gap-3">
              <VisData class="h-8 w-8 shrink-0" color="fill-current" />
              Visualize this data on avoiding future impacts
              <LinkArrow />
            </Button>
          </div>
        {/if}
      </div>
    {/if}
  </svelte:fragment>
</PageLayout>
