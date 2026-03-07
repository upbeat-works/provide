<script>
  import ContentPageIntro from '$lib/helper/ContentPages/ContentPageIntro.svelte';
  import NestedNav from '$lib/helper/ScrollContent/NestedNav.svelte';

  export let subNavigation;
  export let sections;
  export let title;
  export let intro;
  export let dynamicNavigation = false;
  export let isCaseStudy;
  export let tag;
  export let subNavigationLabel;
  export let backLink;

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

<ContentPageIntro {tag} {subNavigationLabel} {backLink} {title} {intro} {subNavigation} {isCaseStudy} />

<div class="grid grid-rows-[auto_auto] grid-cols-1 md:grid-cols-[280px_1fr] md:grid-rows-1 gap-10 md:gap-6 lg:gap-10 mx-auto max-w-7xl px-2 sm:px-6">
  <div class="pt-8 md:border-r border-contour-weakest sticky top-0 h-fit">
    <NestedNav contentRef={dynamicNavigation && contentRef} {sections} {activeIndex} />
  </div>
  <div class="md:pt-8">
    <div bind:this={contentRef}>
      {#each sections as section, i}
        <section use:observeSection={i} class="mt-10 pt-10 border-contour-weakest first:border-0 first:mt-0 last:mb-12" class:border-t={section.title && !section.omitBorder} class:pt-12={section.title}>
          <svelte:component this={section.component} title={section.title} {...section.props} />
          {#each section.sections ?? [] as part}
            <svelte:component this={part.component} title={part.title} {...part.props} />
          {/each}
        </section>
      {/each}
    </div>
    <slot />
  </div>
</div>
