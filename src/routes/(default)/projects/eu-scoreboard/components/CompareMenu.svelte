<script>
  import { Popover, PopoverButton, PopoverPanel } from '@rgossiaux/svelte-headlessui';
  import { createPopperActions } from 'svelte-popperjs';
  import Button from '$lib/components/ui/Button.svelte';
  import Compare from '$lib/components/icons/Compare.svelte';
  import FilterSelect from './FilterSelect.svelte';

  // Turns the view into a side-by-side comparison of one dimension. Off, it is
  // a button that opens the list of dimensions; on, it names the comparison and
  // lets it be switched or closed — the chosen dimension leaves the filter bar
  // and reappears as a selector on each map.
  export let dimensions = [];
  // The dimension being compared, or undefined when not comparing.
  export let selected = undefined;

  const [popperRef, popperContent] = createPopperActions();
  const popperOptions = {
    placement: 'bottom-end',
    strategy: 'fixed',
    modifiers: [{ name: 'offset', options: { offset: [0, 10] } }],
  };
</script>

{#if selected}
  <div class="flex items-center gap-3">
    <button type="button" class="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-theme-base hover:text-theme-stronger" on:click={() => (selected = undefined)}>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
      Comparison
    </button>
    <FilterSelect
      label="Comparison"
      options={dimensions}
      bind:selected
      labelClass="sr-only"
      wrapperClass="min-w-[9rem]"
      buttonClass="rounded border border-contour-weakest px-3 py-1.5 text-sm"
    />
  </div>
{:else}
  <Popover class="relative">
    <PopoverButton as="div" use={[popperRef]} class="cursor-pointer">
      <Button variant="outline" size="sm">
        <Compare class="h-4 w-4" />
        Compare
      </Button>
    </PopoverButton>

    <PopoverPanel use={[[popperContent, popperOptions]]} let:close class="z-50 w-[13rem] rounded border border-contour-weakest bg-surface-base shadow-md">
      <span class="block px-4 pb-1 pt-3 text-xs uppercase tracking-widest text-text-weaker">Compare</span>
      <ul class="pb-2">
        {#each dimensions as dimension (dimension.uid)}
          <li>
            <button
              type="button"
              class="w-full px-4 py-2 text-left text-theme-base hover:bg-surface-weaker"
              on:click={() => {
                selected = dimension;
                close();
              }}
            >
              {dimension.label}
            </button>
          </li>
        {/each}
      </ul>
    </PopoverPanel>
  </Popover>
{/if}
