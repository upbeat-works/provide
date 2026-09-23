<script>
  import { onDestroy } from 'svelte';
  import { createScrollSpy } from '$lib/utils/scrollSpy';
  import NestedNav from '$lib/components/navigation/NestedNav.svelte';

  // The side nav the methodology pages use, so the scoreboard's index is the
  // same menu. NestedNav scrapes h2/h3 whenever it is handed a `contentRef`, and
  // these labels are deliberately not the headings (the last section's heading
  // names the hazard, the index just says there is more data) — so the spy runs
  // here and NestedNav is used in its static mode, told which item is active.
  export let sections = [];
  export let contentRef = undefined;
  export let label = 'Index';

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

  // NestedNav renders only the entries it considers to carry content.
  $: navSections = sections.map(({ slug, title }) => ({ slug, title, content: true }));

  onDestroy(() => spy?.destroy());
</script>

<NestedNav sections={navSections} {activeIndex} title={label} onNavigate={(i) => spy?.click(i)} />
