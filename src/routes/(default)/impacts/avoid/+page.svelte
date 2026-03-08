<script>
  import ThresholdLevels from './ThresholdLevels/ThresholdLevels.svelte';
  import StudyLocations from './StudyLocations/StudyLocations.svelte';
  import UnAvoidableRisk from '../UnavoidableRisk/UnavoidableRisk.svelte';
  import Reference from './Reference/Reference.svelte';
  import SimpleNav from '$lib/helper/ScrollContent/SimpleNav.svelte';
  import { IS_COMBINATION_AVAILABLE, IS_EMPTY_SELECTION, SELECTABLE_SCENARIOS } from '$stores/state';
  import { IS_EMPTY_LEVEL_OF_IMPACT, IS_EMPTY_LIKELIHOOD_LEVEL } from '$stores/avoid.js';
  import { SCENARIOS_IN_AVOIDING_IMPACTS, KEY_SCENARIO_ENDYEAR } from '$config';
  import THEME from '$styles/theme-store.js';
  import FallbackMessage from '$lib/helper/FallbackMessage.svelte';
  import SelectionCertaintyLevels from './Selection/CertaintyLevels/CertaintyLevels.svelte';
  import SelectionStudyLocations from './Selection/StudyLocations/StudyLocations.svelte';
  import { writable } from 'svelte/store';
  import PageHero from '$lib/site/PageHero.svelte';
  import { SelectionControls } from '$lib/controls/ExploreControls';
  import ImpactLevel from './Reference/ImpactLevel.svelte';

  $: isValidSelection = !$IS_EMPTY_SELECTION && $IS_COMBINATION_AVAILABLE && !$IS_EMPTY_LEVEL_OF_IMPACT && !$IS_EMPTY_LIKELIHOOD_LEVEL;

  let THRESHOLD_LEVELS_DATA = writable({});

  $: currentScenarios = SCENARIOS_IN_AVOIDING_IMPACTS.map((uid) => $SELECTABLE_SCENARIOS.find((scenario) => scenario.uid === uid))
    .filter(Boolean)
    .map(({ uid, label, [KEY_SCENARIO_ENDYEAR]: timeframe }, i) => ({ uid, label, [KEY_SCENARIO_ENDYEAR]: timeframe, color: $THEME.color.category.base[i] }));

  $: sections = [
    { component: FallbackMessage, disabled: isValidSelection },
    {
      slug: 'threshold-levels',
      title: 'Impact Level',
      description: 'When will the impact level be exceeded?',
      component: ThresholdLevels,
      disabled: !isValidSelection,
      props: {
        store: THRESHOLD_LEVELS_DATA,
        tagline: 'Impact Level',
      },
    },
    {
      slug: 'locations',
      title: 'Locations',
      description: 'When will the impact level be exceeded across different locations?',
      component: StudyLocations,
      disabled: !isValidSelection,
      props: {
        store: THRESHOLD_LEVELS_DATA,
        tagline: 'Locations',
      },
    },
    // {
    //   slug: 'unavoidable-risk',
    //   title: '(Un)avoidable risk',
    //   description: 'What can be avoided through emissions reductions?',
    //   component: UnAvoidableRisk,
    //   disabled: !isValidSelection,
    //   props: {
    //     currentScenarios: currentScenarios,
    //   },
    // },
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

<PageHero className="bg-petrol-900" label="PROVIDE" title="Avoiding future impacts" description="Explore which scenarios minimise the risk from certain impacts in cities and their rural surroundings. Understand the likelihood of exceeding the impact levels you would like to avoid." />

<SelectionControls sticky />

<div class="relative grid grid-rows-[auto_auto] grid-cols-1 md:grid-cols-[280px_1fr] md:grid-rows-1 mx-auto max-w-7xl">
  <nav class="pl-6 py-6 flex flex-col gap-4 md:sticky md:top-[129px] h-fit">
    <SimpleNav {sections} {activeIndex} />
  </nav>
  <div class="md:border-l border-contour-weakest">
    <div class="flex md:sticky md:top-[129px] z-20 bg-white border-b border-contour-weakest">
      <ImpactLevel />
      <SelectionCertaintyLevels />
      <SelectionStudyLocations />
    </div>
    <div class="relative px-6 py-12">
      {#each sections as section, i}
        {#if !section.disabled}
          <section use:observeSection={i} id={section.slug} name={section.slug} class="scroll-mt-4 mb-16 border-b pb-14 border-contour-weaker last:border-none">
            <svelte:component this={section.component} {...section.props} />
          </section>
        {/if}
      {/each}
    </div>
  </div>
</div>
