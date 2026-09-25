<script>
  import { RadioGroup } from '@rgossiaux/svelte-headlessui';
  import { tick } from 'svelte';
  import GeographyGroup from './GeographyGroup.svelte';
  import { leafDescendantCount } from './geography-tree.js';
  import Chevron from '$lib/components/icons/Chevron.svelte';
  import Fuse from 'fuse.js';
  import { GEOGRAPHY_INDEX } from '$stores/meta.js';

  import { sortBy, groupBy } from 'lodash-es';

  export let items = [];
  export let currentUid;
  export let hoveredItem;
  export let term = '';
  export let isOpen = false;
  export let geographyType; // { uid, label, ... } of the active type pill

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

  $: results = (!hasSearchTerm ? defaultResults : fuse.search(term)).map(({ item, matches }) => {
    let label = item.label;
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
      originalLabel: item.label,
      matches,
    };
  });

  $: groupedItems = !hasSearchTerm ? groupResults(results) : undefined;

  function groupResults(results) {
    const groups = groupBy(results, 'group');
    return sortBy(Object.entries(groups), '0');
  }

  // Country-rooted hierarchy: the Countries tab groups by continent and lets the
  // user expand a country to drill into its children inline.
  $: isCountryMode = geographyType?.uid === 'admin0';

  $: continentGroups = sortBy(Object.entries($GEOGRAPHY_INDEX.countriesByContinent), ['0']);

  const headingClass = 'mt-4 mb-1 px-5 text-xs font-medium uppercase tracking-wider text-theme-weaker';

  let collapsedContinents = {};

  function toggleContinent(uid) {
    collapsedContinents = { ...collapsedContinents, [uid]: !collapsedContinents[uid] };
  }

  let box;
  $: term, box?.scrollTo({ top: 0 });

  let wasOpen = false;
  $: {
    if (isOpen && !wasOpen) {
      wasOpen = true;
      void scrollToSelected();
    } else if (!isOpen) {
      wasOpen = false;
    }
  }

  async function scrollToSelected() {
    await tick();
    if (!isOpen) return;
    box?.querySelector('[role="radio"][aria-checked="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }
</script>

<div bind:this={box} class="w-full overflow-x-hidden pt-2 pb-4">
  <RadioGroup bind:value={currentUid}>
    {#if hasSearchTerm}
      {#if results.length}
        <GeographyGroup group={results} bind:hoveredItem {currentUid} asCountries={isCountryMode} />
      {:else}
        <span class="text-xs py-4 px-5 block text-text-weaker" role="status">Could not find any geographies for this type.</span>
      {/if}
    {:else if isCountryMode}
      {#each continentGroups as [continentId, countries]}
        {@const continentLabel = $GEOGRAPHY_INDEX.byId[continentId]?.label ?? continentId}
        {@const leafCount = leafDescendantCount($GEOGRAPHY_INDEX, continentId)}
        <!-- RadioGroup marks descendants without a role as presentational. -->
        <button
          type="button"
          role="button"
          class="{headingClass} flex w-full items-center justify-between text-left hover:text-theme-base focus:outline-none focus:text-theme-base"
          aria-label="{collapsedContinents[continentId] ? 'Expand' : 'Collapse'} {continentLabel}"
          aria-expanded={!collapsedContinents[continentId]}
          on:click={() => toggleContinent(continentId)}
        >
          <span>{continentLabel}</span>
          <span class="flex items-center gap-2">
            <span class="tabular-nums text-text-weaker">{leafCount}</span>
            <Chevron class="h-4 w-4" isOpen={!collapsedContinents[continentId]} />
          </span>
        </button>
        {#if !collapsedContinents[continentId]}
          <GeographyGroup group={countries} bind:hoveredItem {currentUid} asCountries={true} />
        {/if}
      {/each}
    {:else if results.length}
      {#each groupedItems as [key, group]}
        <!-- Types whose geographies carry no `group` (river basins, EEZs …)
             produce a single "undefined" bucket — that is one flat list, not a
             group, so it gets no heading. -->
        {#if key && key !== 'undefined'}
          <span class="{headingClass} block">{key}</span>
        {/if}
        <GeographyGroup {group} bind:hoveredItem {currentUid} />
      {/each}
    {:else}
      <span class="text-xs py-4 px-5 block text-text-weaker" role="status">Could not find any geographies for this type.</span>
    {/if}
  </RadioGroup>
</div>
