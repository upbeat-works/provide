<script>
  import ThresholdLevels from './ThresholdLevels/ThresholdLevels.svelte';
  import StudyLocations from './StudyLocations/StudyLocations.svelte';
  import SimpleNav from '$lib/helper/ScrollContent/SimpleNav.svelte';
  import { IS_COMBINATION_AVAILABLE, IS_EMPTY_SELECTION } from '$stores/state';
  import { IS_EMPTY_LEVEL_OF_IMPACT, IS_EMPTY_LIKELIHOOD_LEVEL } from '$stores/avoid.js';
  import FallbackMessage from '$lib/helper/FallbackMessage.svelte';
  import SelectionCertaintyLevels from './Selection/CertaintyLevels/CertaintyLevels.svelte';
  import SelectionStudyLocations from './Selection/StudyLocations/StudyLocations.svelte';
  import { writable } from 'svelte/store';
  import PageHero from '$lib/site/PageHero.svelte';
  import { SelectionControls, ControlTabs } from '$lib/controls/ExploreControls';
  import ImpactLevel from './Reference/ImpactLevel.svelte';
  import PageLayout from '$lib/site/PageLayout.svelte';

  $: isValidSelection = !$IS_EMPTY_SELECTION && $IS_COMBINATION_AVAILABLE && !$IS_EMPTY_LEVEL_OF_IMPACT && !$IS_EMPTY_LIKELIHOOD_LEVEL;

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
    <PageHero className="bg-petrol-900" label="PROVIDE" title="Avoiding future impacts" description="Explore which scenarios minimise the risk from certain impacts in cities and their rural surroundings. Understand the likelihood of exceeding the impact levels you would like to avoid." />
  </svelte:fragment>

  <svelte:fragment slot="nav">
    <div class="bg-slate-50 pt-8">
      <div class="mx-auto max-w-7xl px-6">
        <ControlTabs />
      </div>
    </div>
    <hr class="border-t border-contour-weakest" />
    <SelectionControls />
  </svelte:fragment>

  <svelte:fragment slot="sidebar">
    <SimpleNav {sections} {activeIndex} />
  </svelte:fragment>

  <svelte:fragment slot="filters">
    <ImpactLevel />
    <SelectionCertaintyLevels />
    <SelectionStudyLocations />
  </svelte:fragment>

  <svelte:fragment slot="content">
    {#each sections as section, i}
      {#if !section.disabled}
        <section use:observeSection={i} id={section.slug} name={section.slug} class="scroll-mt-4 mb-16 border-b pb-14 border-contour-weaker last:border-none">
          <svelte:component this={section.component} {...section.props} />
        </section>
      {/if}
    {/each}
  </svelte:fragment>
</PageLayout>
