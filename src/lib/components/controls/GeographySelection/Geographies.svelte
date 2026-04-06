<script>
  import { RadioGroup } from '@rgossiaux/svelte-headlessui';
  import GeographyGroup from './GeographyGroup.svelte';
  import Fuse from 'fuse.js';

  import { sortBy, groupBy } from 'lodash-es';

  export let items = [];
  export let currentUid;
  export let hoveredItem;
  export let term = '';

  const options = {
    includeScore: true,
    keys: ['label', 'uid', 'group'],
    includeMatches: true,
  };

  $: fuse = new Fuse(items, options);

  $: defaultResults = sortBy(
    items.map((d) => ({ item: d })),
    ['item.label']
  );

  $: hasSearchTerm = String(term).trim().length;

  // Search with default options
  $: results = (!hasSearchTerm ? defaultResults : fuse.search(term)).map(({ item, matches }) => {
    let label = item.label;
    // Highlighting matching substrings
    if (matches) {
      const match = matches.find((d) => d.key === 'label');
      if (match) {
        label = '';
        for (let i = 0; i < match.indices.length; i++) {
          const [start, end] = match.indices[i]; // Get start and end of this match
          if (i === 0) {
            // In the first round, we might need to add to the beginning
            if (!(start === 0 || end === 0)) {
              label += `${item.label.substring(0, start)}`;
            }
          }

          label += `<mark>${item.label.substring(start, end + 1)}</mark>`;

          if (end !== item.label.length - 1) {
            // If we are not at the end of the string
            let nextStart = item.label.length; // We set the end to the end of the string and …
            if (match.indices[i + 1]) {
              // test if we have another index coming next so that …
              [nextStart] = match.indices[i + 1]; // we use that start instead of the end of the string
            }
            // Now, we add this string unmarked to the label.
            // We need to add 1 to the start-index if the currentUid match was not at the beginning
            label += `${item.label.substring(end + 1, nextStart)}`;
          }
        }
      }
    }
    return {
      ...item,
      label,
      matches,
    };
  });

  $: groupedItems = !hasSearchTerm ? groupResults(results) : undefined;

  function groupResults(results) {
    const groups = groupBy(results, 'group');
    return sortBy(Object.entries(groups), '0');
  }

  let box;
  $: term, box?.scrollTo({ top: 0 });
</script>

<div bind:this={box} class="w-full overflow-x-hidden">
  <RadioGroup bind:value={currentUid} on:change={(e) => (currentUid = e.detail)}>
      {#key results.length}
        {#if results.length}
          {#if hasSearchTerm}
            <GeographyGroup group={results} bind:hoveredItem />
          {:else}
            {#each groupedItems as [key, group]}
              <span class="mx-5 mb-1 block text-xs text-text-weaker uppercase tracking-wide border-b border-b-contour-weakest mt-4">{key}</span>
              <GeographyGroup {group} bind:hoveredItem />
            {/each}
          {/if}
        {:else}
          <span class="text-xs py-4 px-5 block text-text-weaker" role="status">Could not find any geographies for this type.</span>
        {/if}
      {/key}
  </RadioGroup>
</div>
