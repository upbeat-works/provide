<script>
  import { RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import InteractiveListItem from '$lib/components/ui/InteractiveListItem.svelte';
  import CountryAccordion from './CountryAccordion.svelte';
  export let group;
  export let hoveredItem;
  // When set, rows render as expandable country accordions.
  export let asCountries = false;
</script>

{#each group as item}
  {#if asCountries}
    <CountryAccordion country={item} bind:hoveredItem />
  {:else}
    <RadioGroupOption value={item.uid} let:checked class="focus:bg-surface-weaker focus:outline-none">
      <InteractiveListItem icon={item.icon ?? item.emoji} label={item.label} uid={item.uid} selected={checked} bind:hovered={hoveredItem} />
    </RadioGroupOption>
  {/if}
{/each}
