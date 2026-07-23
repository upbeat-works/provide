<script>
  import { RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import InteractiveListItem from '$lib/components/ui/InteractiveListItem.svelte';
  import Chevron from '$lib/components/icons/Chevron.svelte';
  import { GEOGRAPHY_INDEX, GEOGRAPHY_TYPES } from '$stores/meta.js';
  import { childGroups } from './geography-tree.js';

  export let country; // { uid, label, emoji, icon }
  export let hoveredItem;

  let expanded = false;

  $: groups = childGroups($GEOGRAPHY_INDEX, country.uid);
  $: childCount = groups.reduce((n, g) => n + g.items.length, 0);
  $: typeLabel = (uid) => $GEOGRAPHY_TYPES.find((t) => t.uid === uid)?.label ?? uid;

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
  <div class="relative flex items-center">
    <div class="grow min-w-0">
      <RadioGroupOption
        value={country.uid}
        let:checked
        class="block focus:bg-surface-weaker focus:outline-none"
        on:click={() => {
          if (childCount) expanded = true;
        }}
      >
        <InteractiveListItem icon={country.icon ?? country.emoji} label={country.label} uid={country.uid} selected={checked} bind:hovered={hoveredItem} />
      </RadioGroupOption>
    </div>
    {#if childCount}
      <button
        type="button"
        class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 px-3 text-text-weaker hover:text-theme-base"
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse' : 'Expand'}
        on:click|stopPropagation={toggle}
        on:keydown={onCaretKeydown}
      >
        <span class="text-xs tabular-nums">{childCount}</span>
        <Chevron isOpen={expanded} />
      </button>
    {/if}
  </div>

  {#if expanded}
    <div class="border-l border-contour-weakest ml-5">
      {#each groups as { type, items }}
        <span class="mx-3 mt-2 mb-1 block text-xs uppercase tracking-wide text-text-weaker">{typeLabel(type)}</span>
        {#each items as child}
          <RadioGroupOption value={child.uid} let:checked class="block focus:bg-surface-weaker focus:outline-none">
            <InteractiveListItem icon={child.icon ?? child.emoji} label={child.label} uid={child.uid} selected={checked} bind:hovered={hoveredItem} />
          </RadioGroupOption>
        {/each}
      {/each}
    </div>
  {/if}
</div>
