<script>
  import ImpactTime from './components/ImpactTime/ImpactTime.svelte';
  import ImpactGeo from './components/ImpactGeo/ImpactGeo.svelte';
  import UnAvoidableRisk from '../components/UnavoidableRisk/UnavoidableRisk.svelte';
  import ScenarioSelection from '$lib/components/controls/ScenarioSelection/ScenarioSelection.svelte';
  import { IS_COMBINATION_AVAILABLE, IS_EMPTY_SELECTION, CURRENT_GEOGRAPHY, IS_STATIC } from '$stores/state';
  import { GEOGRAPHIES } from '$stores/meta.js';
  import { GEOGRAPHY_TYPE_CITY } from '$config';
  import { IS_COMBINATION_AVAILABLE, IS_EMPTY_SELECTION } from '$stores/state';
  import VisData from '$lib/components/icons/VisData.svelte';
  import { PATH_AVOID } from '$config';
  import FallbackMessage from '$lib/components/ui/FallbackMessage.svelte';
  import ParameterSelection from '$lib/components/controls/ParameterSelection.svelte';
  import ModeSelectionTabs from '$lib/components/controls/ModeSelectionTabs.svelte';
  import IndicatorFilters from './components/IndicatorFilters.svelte';
  import PageHero from '$lib/components/layouts/PageHero.svelte';
  import PageLayout from '$lib/components/layouts/PageLayout.svelte';
  import SimpleNav from '$lib/components/navigation/SimpleNav.svelte';
  import ShareLink from '../components/ShareLink/ShareLink.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
  import LinkSection from './components/ImpactGeo/LinkSection.svelte';

  export let data;

  $: isValidSelection = !$IS_EMPTY_SELECTION && $IS_COMBINATION_AVAILABLE;

  $: caseStudyGeography = $CURRENT_GEOGRAPHY?.adaptationCaseStudy
    ? $GEOGRAPHIES[GEOGRAPHY_TYPE_CITY]?.find((d) => d.uid === $CURRENT_GEOGRAPHY.adaptationCaseStudy) ?? null
    : null;
  $: caseStudy = caseStudyGeography
    ? (data.caseStudies?.find((d) => d.cityUid === caseStudyGeography.uid) ?? null)
    : null;

  $: sections = [
    {
      slug: 'impact-time',
      title: 'Timing',
      description: 'How will this climate impact change?',
      component: ImpactTime,
      disabled: !isValidSelection,
      props: { tagline: 'Timing' },
    },
    {
      slug: 'impact-geo',
      title: 'Location',
      description: 'Where will impacts hit the hardest?',
      component: ImpactGeo,
      disabled: !isValidSelection,
      props: { tagline: 'Location' },
    },
    {
      slug: 'unavoidable-risk',
      title: '(Un)avoidable risk',
      description: 'What can be avoided through emissions reductions?',
      component: UnAvoidableRisk,
      disabled: !isValidSelection,
      props: { tagline: '(Un)avoidable risk' },
    },
    { component: FallbackMessage, disabled: isValidSelection },
  ];

  let activeIndex = 0;

  function observeSection(node, index) {
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) activeIndex = index; },
      { threshold: 0.1 }
    );
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }
</script>

<PageLayout>
  <svelte:fragment slot="hero">
    <PageHero label="EXPLORER" title="Future impacts" description="Explore how different levels of climate action will lead to different climate impacts for countries, cities, and more. See where risk escalates and under what conditions impacts could be avoided." />
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
    <h2 class="font-display text-xs uppercase text-theme-800 font-semibold tracking-wide">Report Index</h2>
    <SimpleNav {sections} {activeIndex} />
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
    {#each sections as section, i}
      {#if !section.disabled}
        <section use:observeSection={i} id={section.slug} name={section.slug} class="scroll-mt-4 mb-8 pb-8 -mx-6 px-6 border-contour-weakest border-b last:border-none">
          <svelte:component this={section.component} {...section.props} />
        </section>
        {#if section.slug === 'impact-geo' && !$IS_STATIC && $CURRENT_GEOGRAPHY}
          <div class="mb-8 pb-8 -mx-6 px-6 border-b border-contour-weakest">
            <LinkSection geography={$CURRENT_GEOGRAPHY} {caseStudy} />
          </div>
        {/if}
      {/if}
    {/each}
    {#if isValidSelection}
      <div class="flex justify-center">
        <Button href="/impacts/{PATH_AVOID}" variant="secondary" class="!px-8 !py-4 !text-base !gap-3">
          <VisData class="h-8 w-8 shrink-0" color="fill-current" />
          Visualize this data on avoiding future impacts
          <LinkArrow />
        </Button>
      </div>
    {/if}
  </svelte:fragment>
</PageLayout>
