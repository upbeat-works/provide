<script>
  import PageHero from '$lib/components/layouts/PageHero.svelte';
  import NestedNav from '$lib/components/navigation/NestedNav.svelte';
  import PageLayout from '$lib/components/layouts/PageLayout.svelte';

  export let sections;
  export let title;
  export let intro = undefined;
  export let label = undefined;
  export let dynamicNavigation = false;

  let contentRef;
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
    <PageHero {label} {title} description={intro} />
  </svelte:fragment>

  <svelte:fragment slot="sidebar">
    <NestedNav contentRef={dynamicNavigation && contentRef} {sections} {activeIndex} />
  </svelte:fragment>

  <svelte:fragment slot="content">
    <div bind:this={contentRef}>
      {#each sections as section, i}
        <section use:observeSection={i} class="pt-4 pb-8 border-contour-weakest first:border-0 first:mt-0 last:mb-12" class:border-t={section.title && !section.omitBorder} class:pt-12={section.title}>
          <svelte:component this={section.component} title={section.title} {...section.props} />
          {#each section.sections ?? [] as part}
            <svelte:component this={part.component} title={part.title} {...part.props} />
          {/each}
        </section>
      {/each}
    </div>
    <slot />
  </svelte:fragment>
</PageLayout>
