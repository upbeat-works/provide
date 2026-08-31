<script>
  import { RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import InteractiveListItem from '$lib/components/ui/InteractiveListItem.svelte';
  import Chevron from '$lib/components/icons/Chevron.svelte';
  import GeographyType from '$lib/components/icons/GeographyType.svelte';
  import { GEOGRAPHY_INDEX, GEOGRAPHY_TYPES } from '$stores/meta.js';
  import { childGroups, plainLabel } from './geography-tree.js';
  import { iconOf } from './flags.js';

  export let country; // { uid, label, geoId }
  export let hoveredItem;
  export let currentUid = undefined;

  let expanded = false;
  // One child type is open at a time: a country's basins/cities/EEZs collapse to
  // a labelled row with a count, so a country with many children stays scannable
  // and the tree reads as a menu rather than a wall of names.
  let openType = null;

  $: groups = childGroups($GEOGRAPHY_INDEX, country.uid);
  $: childCount = groups.reduce((n, g) => n + g.items.length, 0);
  $: typeLabel = (uid) => plainLabel($GEOGRAPHY_TYPES.find((t) => t.uid === uid)?.label ?? uid);

  // Expansion follows the selection, wherever it was made (row, map, deep link):
  // the country that owns it opens — along with the type group holding it — and
  // the country the user just moved away from closes, so only one branch of the
  // tree is ever open. The caret still opens a country the user is only browsing;
  // this only re-runs when the selection itself changes.
  $: selectedGroup = currentUid ? groups.find((g) => g.items.some((i) => i.uid === currentUid)) : undefined;
  $: if (selectedGroup) {
    expanded = true;
    openType = selectedGroup.type;
  } else if (currentUid === country.uid) {
    expanded = childCount > 0;
  } else if (currentUid) {
    expanded = false;
    openType = null;
  }

  // Selection (name) and expansion (caret) are distinct affordances. Selecting a
  // country auto-expands so its children are immediately reachable; the caret
  // toggles open/closed without changing the selection.
  function toggle() {
    if (childCount) expanded = !expanded;
  }
  function onCaretKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  }
</script>

<div>
  <div class="group relative flex items-center">
    <div class="grow min-w-0">
      <RadioGroupOption value={country.uid} let:checked class="block focus:bg-surface-weaker focus:outline-none">
        <InteractiveListItem size="md" icon={iconOf(country)} label={country.label} uid={country.uid} selected={checked} bind:hovered={hoveredItem} />
      </RadioGroupOption>
    </div>
    {#if childCount}
      <!-- The caret stays out of the way until the row is in play, so the list
           reads as plain country names: it appears on hover/focus and stays put
           once the country is open. -->
      <button
        type="button"
        class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center px-3 text-theme-base transition-opacity group-hover:opacity-100 focus:opacity-100 focus:outline-none"
        class:opacity-0={!expanded}
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${country.label}` : `Expand ${country.label}`}
        on:click|stopPropagation={toggle}
        on:keydown={onCaretKeydown}
      >
        <Chevron />
      </button>
    {/if}
  </div>

  {#if expanded}
    {#each groups as { type, items } (type)}
      <button
        type="button"
        class="flex w-full items-center gap-3 py-1.5 pl-12 pr-4 text-left text-theme-base hover:bg-surface-weaker focus:bg-surface-weaker focus:outline-none"
        aria-expanded={openType === type}
        on:click={() => (openType = openType === type ? null : type)}
      >
        <GeographyType {type} class="h-5 w-5 shrink-0" />
        <span class="grow truncate text-xs font-medium uppercase tracking-wider">{typeLabel(type)}</span>
        <span class="text-xs tabular-nums">{items.length}</span>
        <Chevron class="shrink-0 transition-transform {openType === type ? '' : '-rotate-90'}" />
      </button>
      {#if openType === type}
        {#each items as child (child.uid)}
          <RadioGroupOption value={child.uid} let:checked class="block focus:bg-surface-weaker focus:outline-none">
            <InteractiveListItem size="md" class="pl-[4.25rem]" icon={iconOf(child)} label={child.label} uid={child.uid} selected={checked} bind:hovered={hoveredItem} />
          </RadioGroupOption>
        {/each}
      {/if}
    {/each}
  {/if}
</div>
