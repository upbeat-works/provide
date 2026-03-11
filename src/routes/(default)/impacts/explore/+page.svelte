<script>
  import ImpactTime from './ImpactTime/ImpactTime.svelte';
  import ImpactGeo from './ImpactGeo/ImpactGeo.svelte';
  import UnAvoidableRisk from '../UnavoidableRisk/UnavoidableRisk.svelte';
  import ScenarioSelection from './ScenarioSelection/ScenarioSelection.svelte';
  import SimpleNav from '$lib/helper/ScrollContent/SimpleNav.svelte';
  import { IS_COMBINATION_AVAILABLE, IS_EMPTY_SELECTION } from '$stores/state';
  import FallbackMessage from '$lib/helper/FallbackMessage.svelte';
  import { IndicatorParameters } from '$lib/controls/ExploreControls';
  import PageHero from '$lib/site/PageHero.svelte';
  import { SelectionControls } from '$lib/controls/ExploreControls';

  $: isValidSelection = !$IS_EMPTY_SELECTION && $IS_COMBINATION_AVAILABLE;

  $: sections = [
    {
      slug: 'impact-time',
      title: 'Timing',
      description: 'How will this climate impact change?',
      component: ImpactTime,
      disabled: !isValidSelection,
      props: {
        tagline: 'Timing',
      },
    },
    {
      slug: 'impact-geo',
      title: 'Location',
      description: 'Where will impacts hit the hardest?',
      component: ImpactGeo,
      disabled: !isValidSelection,
      props: {
        tagline: 'Location',
      },
    },
    {
      slug: 'unavoidable-risk',
      title: '(Un)avoidable risk',
      description: 'What can be avoided through emissions reductions?',
      component: UnAvoidableRisk,
      disabled: !isValidSelection,
      props: {
        tagline: '(Un)avoidable risk',
      },
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

<PageHero label="EXPLORER" title="Future impacts" description="Explore how different levels of climate action will lead to different climate impacts for countries, cities, and more. See where risk escalates and under what conditions impacts could be avoided." />

<SelectionControls sticky />

<div class="relative grid grid-rows-[auto_auto] grid-cols-1 md:grid-cols-[280px_1fr] md:grid-rows-1 mx-auto max-w-7xl">
  <nav class="md:pl-6 md:py-6 flex flex-col gap-4 md:sticky md:top-[129px] h-fit">
    <SimpleNav {sections} {activeIndex} />
  </nav>
  <div class="md:border-l border-contour-weakest border-t md:border-t-0">
    <div class="flex md:sticky md:top-[129px] z-20 bg-white border-b border-contour-weakest">
      <ScenarioSelection />
      <IndicatorParameters/>
    </div>
    <div class="relative px-6 py-12">
      {#each sections as section, i}
        {#if !section.disabled}
          <section use:observeSection={i} id={section.slug} name={section.slug} class="scroll-mt-4 mb-16 pb-14 border-contour-weakest border-b last:border-none">
            <svelte:component this={section.component} {...section.props} />
          </section>
        {/if}
      {/each}
    </div>
  </div>
</div>
