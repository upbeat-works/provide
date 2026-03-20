<script>
  import ImpactTime from './components/ImpactTime/ImpactTime.svelte';
  import ImpactGeo from './components/ImpactGeo/ImpactGeo.svelte';
  import UnAvoidableRisk from '../components/UnavoidableRisk/UnavoidableRisk.svelte';
  import ScenarioSelection from './components/ScenarioSelection/ScenarioSelection.svelte';
  import { IS_COMBINATION_AVAILABLE, IS_EMPTY_SELECTION } from '$stores/state';
  import FallbackMessage from '$lib/components/ui/FallbackMessage.svelte';
  import { IndicatorParameters, SelectionControls, ControlTabs } from '$lib/components/controls/ExploreControls';
  import PageHero from '$lib/components/layouts/PageHero.svelte';
  import PageLayout from '$lib/components/layouts/PageLayout.svelte';
  import SimpleNav from '$lib/components/navigation/SimpleNav.svelte';

  $: isValidSelection = !$IS_EMPTY_SELECTION && $IS_COMBINATION_AVAILABLE;

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
        <ControlTabs />
      </div>
    </div>
    <hr class="border-t border-contour-weakest" />
  </svelte:fragment>

  <svelte:fragment slot="nav">
    <SelectionControls />
    <div class="border-b border-contour-weakest" />
  </svelte:fragment>

  <svelte:fragment slot="sidebar">
    <h2 class="font-display text-xs uppercase text-theme-800 font-semibold tracking-wide">Report Index</h2>
    <SimpleNav {sections} {activeIndex} />
  </svelte:fragment>

  <svelte:fragment slot="filters">
    <ScenarioSelection />
    <IndicatorParameters />
  </svelte:fragment>

  <svelte:fragment slot="content">
    {#each sections as section, i}
      {#if !section.disabled}
        <section use:observeSection={i} id={section.slug} name={section.slug} class="scroll-mt-4 mb-16 pb-14 border-contour-weakest border-b last:border-none">
          <svelte:component this={section.component} {...section.props} />
        </section>
      {/if}
    {/each}
  </svelte:fragment>
</PageLayout>
