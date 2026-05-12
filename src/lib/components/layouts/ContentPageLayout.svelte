<script>
  import PageHero from '$lib/components/layouts/PageHero.svelte';
  import NestedNav from '$lib/components/navigation/NestedNav.svelte';
  import PageLayout from '$lib/components/layouts/PageLayout.svelte';

  export let sections;
  export let title;
  export let intro = undefined;
  export let label = undefined;
  export let tabItems = undefined;
  let contentRef;
</script>

<PageLayout>
  <svelte:fragment slot="hero">
    <PageHero {label} {title} description={intro} {tabItems} />
  </svelte:fragment>

  <svelte:fragment slot="sidebar">
    <NestedNav {contentRef} {sections} />
  </svelte:fragment>

  <svelte:fragment slot="content">
    <div bind:this={contentRef}>
      {#each sections as section}
        <section class="pt-4 pb-8 border-contour-weakest first:border-0 first:mt-0 last:mb-12" class:border-t={section.title && !section.omitBorder} class:pt-12={section.title}>
          <svelte:component this={section.component} {...section.props} />
          {#each section.sections ?? [] as part1}
             <svelte:component this={part1.component} {...part1.props} />
            {#each part1.sections ?? [] as part2}
               <svelte:component this={part2.component} {...part2.props} />
              {#each part2.sections ?? [] as part3}
                 <svelte:component this={part3.component} {...part3.props} />
              {/each}
            {/each}
          {/each}
        </section>
      {/each}
    </div>
    <slot />
  </svelte:fragment>
</PageLayout>
