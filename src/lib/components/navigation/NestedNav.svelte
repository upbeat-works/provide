<script>
  import { slugify } from '$lib/utils/utils';
  import { onDestroy } from 'svelte';

  export let sections = [];
  export let contentRef;
  export let activeIndex = 0;
  export let title = 'Index';

  // Holds key/values for all open sections
  let openSections = {};

  // To prevent reactive opening when manually closing section
  let preventReset = false;

  // Internal active index for dynamic mode (tracks individual headings)
  let dynamicActiveIndex = 0;
  let headingObservers = [];

  // Takes a flat array of h2/h3 titles and turns them into a hierarchy
  const createHierarchy = (flatItems) => {
    if (!flatItems.length) return [];
    let startLevel = Infinity;

    // Set start level in case it doesn't start at 1
    flatItems.forEach((item) => {
      if (item.level < startLevel) {
        startLevel = item.level;
      }
    });
    const createLevel = (items, level) => {
      if (level > 3) return [];
      const levelIndexes = [];
      for (let i = 0; i < items.length; i += 1) {
        if (items[i].level === level) {
          levelIndexes.push(i);
        }
      }

      // If no subindexes are found
      if (!levelIndexes.length) {
        return level === startLevel ? createLevel(items, level + 1) : items;
      }

      // If there are subindexes, create
      return levelIndexes.map((startIndex, i) => {
        const endIndex = i < levelIndexes.length ? levelIndexes[i + 1] : items.length;
        const subItems = items.slice(startIndex + 1, endIndex);
        const item = {
          ...items[startIndex],
        };
        if (subItems.length) {
          item.sections = createLevel(subItems, level + 1);
        }
        return item;
      });
    };

    return createLevel(flatItems, startLevel);
  };

  // If containerRef is given, query all h2/h3 titles from the given container, assign IDs,
  // set up IntersectionObservers on each heading, and build the nav hierarchy.
  $: dynamicNavSections = (() => {
    if (!contentRef) return;
    const headings = contentRef?.querySelectorAll('h2, h3');

    // Clean up previous observers
    headingObservers.forEach((o) => o.disconnect());
    headingObservers = [];

    const flatToc = [...headings].map((el, i) => {
      const slug = el.getAttribute('id') || slugify(el.innerText);
      el.setAttribute('id', slug);

      // Observe each heading individually so activeIndex tracks heading index, not section index
      const io = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) dynamicActiveIndex = i; },
        { threshold: 0.5 }
      );
      io.observe(el);
      headingObservers.push(io);

      return {
        props: {
          title: el.innerText,
          slug,
        },
        level: parseFloat(el.tagName[1]),
        content: true,
      };
    });

    return createHierarchy(flatToc);
  })();

  onDestroy(() => {
    headingObservers.forEach((o) => o.disconnect());
  });

  // In dynamic mode use the internally tracked heading index;
  // in static mode use the activeIndex prop (tracks top-level sections).
  $: effectiveActiveIndex = dynamicNavSections ? dynamicActiveIndex : activeIndex;

  // Allow again reactive opening whenever active index changes
  $: if (effectiveActiveIndex !== undefined) {
    preventReset = false;
  }

  // Add indexes to sections and subsections to see if section is active.
  // In dynamic mode children increment the counter (matching flat heading index).
  // In static mode children do NOT increment (matching top-level section index from ContentPageLayout).
  $: navSections = (dynamicNavSections || sections).reduce(
    (acc, section) => {
      const children = section?.sections ?? [];
      acc.sections.push({
        title: section.props?.title ?? section.title,
        slug: section.props?.slug ?? section.slug,
        index: acc.counter,
        isActive: effectiveActiveIndex === acc.counter++,
        hasContent: Boolean(section.content) || children.some(({ props }) => Boolean(props.content)),
        sections: children.map((s) => ({
          title: s.props?.titleShort ?? s.props?.title,
          slug: s.props?.slug,
          index: acc.counter,
          isActive: dynamicNavSections ? effectiveActiveIndex === acc.counter++ : false,
        })),
      });
      return acc;
    },
    { sections: [], counter: 0 }
  ).sections;

  // Whenever user scrolls past major section, we update the open sections to only
  // have the one open that is currently in view
  $: isMajorSection = navSections.find((s) => s.index === effectiveActiveIndex);
  $: if (!preventReset && isMajorSection) {
    openSections = { [effectiveActiveIndex]: true };
  }

  // Final sections take into account whether a child section is active and whether
  // the section is open or not
  $: processedSections = navSections.map((section) => {
    const isActive = section.isActive || !!section.sections.find((s) => s.isActive);
    const isOpen = openSections[section.index];
    return {
      ...section,
      isActive,
      isOpen,
      sections: section.sections.map((s) => (!s.slug || !s.title ? false : s)).filter(Boolean),
    };
  });

  $: toggleSection = (i) => {
    preventReset = true;
    openSections = { ...openSections, [i]: !openSections[i] };
  };
</script>

<nav class="flex flex-col gap-6">
  {#if title}
    <h2 class="font-display text-xs uppercase text-theme-800 font-semibold tracking-wide">{title}</h2>
  {/if}
  <ul data-index={effectiveActiveIndex}>
    {#each processedSections as { title, slug, isActive, index, isOpen, sections, hasContent }}
      {#if hasContent}
        <li class="border-r-3 pr-12"
          class:border-r-theme-base={isActive && (!isOpen || !sections.length)}
          class:border-r-transparent={!isActive || (isOpen && sections.length)}
        >
          <div class="py-2 border-b border-contour-weakest">
            <div aria-expanded={String(isActive)} class:text-theme-base={isActive} class="flex justify-between items-center">
              <a class="font-semibold text-sm" href={`#${slug}`}>{title}</a>
              {#if sections.length}
                <button as="button" class="p-1" class:rotate-180={isOpen} on:click={() => toggleSection(index)}>▾</button>
              {/if}
            </div>
            {#if sections.length && isOpen}
              <ul>
                {#each sections as { slug, title, isActive }}
                  <li class="mt-1 relative">
                    <a aria-current={isActive ? 'step' : 'false'} class="inline-block text-sm font-normal py-1 leading-tight" class:text-theme-base={isActive} href={`#${slug}`}>
                      {title}
                    </a>
                    <span class="absolute inset-y-0 -right-[3.2rem] border-r-3"
                      class:border-r-theme-base={isActive}
                      class:border-r-transparent={!isActive}
                    ></span>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </li>
      {/if}
    {/each}
  </ul>
</nav>
