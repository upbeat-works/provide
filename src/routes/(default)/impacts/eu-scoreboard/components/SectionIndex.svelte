<script>
  import { onDestroy } from 'svelte';
  import { createScrollSpy } from '$lib/utils/scrollSpy';

  // Index for the ranking view's article column. The labels are written for the
  // index, not lifted from the headings (the last section's heading names the
  // hazard, the index just says there is more data), so the sections are passed
  // in rather than scraped from the DOM the way NestedNav does it.
  export let sections = [];
  export let contentRef = undefined;
  export let label = 'Index';
  // Bindable: the section currently in view, so the page can mark it.
  export let activeSlug = undefined;

  let spy = null;
  let activeIndex = 0;

  // The page scrolls in a container, not the window — createScrollSpy finds it.
  $: if (contentRef) {
    spy?.destroy();
    spy = createScrollSpy(contentRef, {
      getItems: () => sections.map(({ slug }) => slug),
      onActive: (i) => {
        activeIndex = i;
      },
    });
  }

  $: activeSlug = sections[activeIndex]?.slug;

  onDestroy(() => spy?.destroy());
</script>

<nav class="flex flex-col gap-3">
  {#if label}
    <p class="text-xs uppercase tracking-widest font-semibold text-contour-weak">{label}</p>
  {/if}
  <ul>
    {#each sections as { slug, title }, i}
      <li class="border-b border-contour-weakest">
        <a
          href={`#${slug}`}
          aria-current={i === activeIndex ? 'step' : 'false'}
          on:click={() => spy?.click(i)}
          class="block py-3 text-sm font-semibold leading-tight transition-colors hover:text-theme-base {i === activeIndex ? 'text-theme-base' : 'text-text-base'}"
        >
          {title}
        </a>
      </li>
    {/each}
  </ul>
</nav>
