<script>
  import ImpactTime from './ImpactTime/ImpactTime.svelte';
  import ImpactGeo from './ImpactGeo/ImpactGeo.svelte';
  import UnAvoidableRisk from '../UnavoidableRisk/UnavoidableRisk.svelte';
  import ScenarioSelection from './ScenarioSelection/ScenarioSelection.svelte';
  import SimpleNav from '$lib/helper/ScrollContent/SimpleNav.svelte';
  import { IS_COMBINATION_AVAILABLE, IS_EMPTY_SELECTION } from '$stores/state';
  import FallbackMessage from '$lib/helper/FallbackMessage.svelte';
  import { IndicatorParameters } from '$lib/controls/ExploreControls';

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

<div class="grid grid-rows-[auto_auto] grid-cols-1 md:grid-cols-[280px_1fr] md:grid-rows-1 mx-auto max-w-7xl">
  <nav class="pt-8 flex flex-col gap-4 md:border-r border-contour-weakest md:sticky md:top-[144px] h-fit">
    <ScenarioSelection />
    <SimpleNav {sections} {activeIndex} />
  </nav>
  <div>
    <div class="md:sticky md:top-[144px] z-30 bg-white">
      <IndicatorParameters/>
    </div>
    {#each sections as section, i}
      {#if !section.disabled}
        <section use:observeSection={i} id={section.slug} name={section.slug} class="scroll-mt-4 mb-16 pb-14 border-contour-weakest border-b last:border-none">
          <svelte:component this={section.component} {...section.props} />
        </section>
      {/if}
    {/each}
  </div>
</div>
