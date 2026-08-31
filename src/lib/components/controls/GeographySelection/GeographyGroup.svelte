<script>
  import { RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import InteractiveListItem from '$lib/components/ui/InteractiveListItem.svelte';
  import CountryAccordion from './CountryAccordion.svelte';
  import { iconOf } from './flags.js';
  export let group;
  export let hoveredItem;
  export let currentUid = undefined;
  // When set, rows render as expandable country accordions.
  export let asCountries = false;
</script>

{#each group as item}
  {#if asCountries}
    <CountryAccordion country={item} bind:hoveredItem {currentUid} />
  {:else}
    <RadioGroupOption value={item.uid} let:checked class="block focus:bg-surface-weaker focus:outline-none">
      <InteractiveListItem size="md" icon={iconOf(item)} label={item.label} uid={item.uid} selected={checked} bind:hovered={hoveredItem} />
    </RadioGroupOption>
  {/if}
{/each}
