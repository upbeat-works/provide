<script>
  import ThresholdLevels from './components/ThresholdLevels/ThresholdLevels.svelte';
  import StudyLocations from './components/StudyLocations/StudyLocations.svelte';
  import SimpleNav from '$lib/components/navigation/SimpleNav.svelte';
  import { HEADER_CLASS, IS_STATIC } from '$stores/state';
  import { AVOID_IS_EMPTY, AVOID_IS_AVAILABLE, AVOID_GEOGRAPHY, AVOID_CITY_UID, AVOID_INDICATOR_UID, AVOID_PARAMS } from '$stores/avoid-catalog.js';
  import { IS_EMPTY_LEVEL_OF_IMPACT, IS_EMPTY_LIKELIHOOD_LEVEL } from '$stores/avoid.js';
  import FallbackMessage from '$lib/components/ui/FallbackMessage.svelte';
  import SelectionCertaintyLevels from './components/Selection/CertaintyLevels/CertaintyLevels.svelte';
  import SelectionStudyLocations from './components/Selection/StudyLocations/StudyLocations.svelte';
  import { writable } from 'svelte/store';
  import PageHero from '$lib/components/layouts/PageHero.svelte';
  import Reference from './components/Reference/Reference.svelte';
  import PageLayout from '$lib/components/layouts/PageLayout.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { createScrollSpy } from '$lib/utils/scrollSpy';
  import AvoidShareLink from './components/AvoidShareLink.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
  import LinkSection from '../explore/components/ImpactGeo/LinkSection.svelte';
  import AvoidParameterSelection from './components/Selection/AvoidParameterSelection.svelte';
  import AvoidParamFilters from './components/Selection/AvoidParamFilters.svelte';
  import { page } from '$app/stores';

  export let data;

  onMount(() => HEADER_CLASS.set('bg-[#1F2B59] border-petrol-400'));
  onDestroy(() => HEADER_CLASS.set(''));

  // Deep-link handoff (explore -> avoid): the incoming ids are already in the
  // avoid-native legacy space (geoId, legacyUid), so we just apply them. Param
  // defaulting/reconciliation is handled by the AVOID_INDICATOR subscription in
  // the store module (which fires as soon as the indicator resolves).
  onMount(() => {
    const url = $page.url;
    const geo = url.searchParams.get('geography');
    const ind = url.searchParams.get('indicator');
    if (geo) AVOID_CITY_UID.set(geo);
    if (ind) AVOID_INDICATOR_UID.set(ind);
    if (geo || ind) {
      const next = {};
      for (const [k, v] of url.searchParams) {
        if (k !== 'geography' && k !== 'indicator') next[k] = v;
      }
      if (Object.keys(next).length) AVOID_PARAMS.update((p) => ({ ...p, ...next }));
    }
  });

  $: isValidSelection = !$AVOID_IS_EMPTY && $AVOID_IS_AVAILABLE && !$IS_EMPTY_LEVEL_OF_IMPACT && !$IS_EMPTY_LIKELIHOOD_LEVEL;

  // Legacy cities carry `adaptationCaseStudy` (a legacy city slug) directly, and
  // case studies key on CityUid (the same slug) — no geo-tree lookup needed.
  $: caseStudy = $AVOID_GEOGRAPHY?.adaptationCaseStudy
    ? (data.caseStudies?.find((d) => d.cityUid === $AVOID_GEOGRAPHY.adaptationCaseStudy) ?? null)
    : null;

  let THRESHOLD_LEVELS_DATA = writable({});

  $: sections = [
    { component: FallbackMessage, disabled: isValidSelection },
    {
      slug: 'threshold-levels',
      title: 'Impact Level',
      description: 'When will the impact level be exceeded?',
      component: ThresholdLevels,
      disabled: !isValidSelection,
      props: { store: THRESHOLD_LEVELS_DATA, tagline: 'Impact Level' },
    },
    {
      slug: 'locations',
      title: 'Locations',
      description: 'When will the impact level be exceeded across different locations?',
      component: StudyLocations,
      disabled: !isValidSelection,
      props: { store: THRESHOLD_LEVELS_DATA, tagline: 'Locations' },
    },
  ];

  let activeIndex = 0;
  let contentEl;
  let spy = null;

  $: if (contentEl) {
    spy?.destroy();
    spy = createScrollSpy(contentEl, {
      getItems: () => sections.map((s) => (s.slug && !s.disabled ? document.getElementById(s.slug) : null)),
      onActive: (i) => { activeIndex = i; },
    });
  }

  function handleNavClick(i) { spy?.click(i); }

  onDestroy(() => spy?.destroy());
</script>

<PageLayout>
  <svelte:fragment slot="hero">
    <PageHero className="bg-[#14364D]" title="Avoiding future impacts" description="Explore which scenarios minimise the risk from certain impacts in cities and their rural surroundings. Understand the likelihood of exceeding the impact levels you would like to avoid.">
      <img slot="label" src="/img/provide-logo-white.png" alt="provide" class="h-6" />
    </PageHero>
    <hr class="border-t border-contour-weakest" />
  </svelte:fragment>

  <svelte:fragment slot="nav">
    <AvoidParameterSelection />
    <div class="border-b border-contour-weakest" />
  </svelte:fragment>

  <svelte:fragment slot="sidebar">
    <SimpleNav {sections} {activeIndex} onNavClick={handleNavClick} />
    <hr class="my-4 border-contour-weakest mr-6" />
    <AvoidShareLink />
    <Button class="mt-4 mr-6" href="/methodology" variant="secondary">
      Learn more about the methodology
      <LinkArrow />
    </Button>
  </svelte:fragment>

  <svelte:fragment slot="filters">
    <Reference />
    <SelectionCertaintyLevels />
    <SelectionStudyLocations />
    <AvoidParamFilters />
  </svelte:fragment>

  <svelte:fragment slot="content">
    <div bind:this={contentEl}>
    {#each sections as section, i}
      {#if !section.disabled}
        <section id={section.slug} name={section.slug} class="scroll-mt-4 mb-8 pb-8 -mx-6 px-6 border-b border-contour-weakest last:border-none">
          <svelte:component this={section.component} {...section.props} />
        </section>
      {/if}
    {/each}
    {#if !$IS_STATIC && $AVOID_GEOGRAPHY}
      <LinkSection geography={$AVOID_GEOGRAPHY} {caseStudy} />
    {/if}
    </div>
  </svelte:fragment>
</PageLayout>
