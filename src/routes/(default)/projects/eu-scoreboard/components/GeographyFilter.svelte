<script>
  import { Popover, PopoverButton, PopoverPanel } from '@rgossiaux/svelte-headlessui';
  import { createPopperActions } from 'svelte-popperjs';
  import Fuse from 'fuse.js';
  import SelectionButton from '$lib/components/controls/components/SelectionButton.svelte';
  import SearchInput from '$lib/components/ui/SearchInput.svelte';

  // The scoreboard's geography filter: a searchable country list in a popover,
  // rather than the full-page modal explore uses to browse every geography type.
  // The scoreboard only ever picks a country (or the whole of its coverage), so
  // a list and a search field is the whole control.
  export let label = 'Geography';
  export let options = [];
  // The selected country, or undefined for the whole coverage.
  export let selected = undefined;
  export let allLabel = 'All available countries';
  export let buttonAllLabel = 'All countries';
  export let placeholder = 'Search geography';
  export let wrapperClass = 'min-w-[10rem]';
  export let buttonClass = 'mt-1 text-sm';

  const [popperRef, popperContent] = createPopperActions();
  const popperOptions = {
    placement: 'bottom-start',
    strategy: 'fixed',
    modifiers: [{ name: 'offset', options: { offset: [0, 10] } }],
  };

  let term = '';

  // Same fuzzy matching as the geography modal's list, so a typo finds the same
  // country in both places.
  $: fuse = new Fuse(options, { keys: ['label', 'uid'], threshold: 0.3 });
  $: matches = term.trim() ? fuse.search(term).map(({ item }) => item) : options;

  function pick(option, close) {
    selected = option;
    term = '';
    close();
  }
</script>

<Popover class={wrapperClass}>
  <!-- `as="div"` so the trigger can be the same SelectionButton the filter bar's
       other controls are, rather than a second button inside a button. -->
  <PopoverButton as="div" use={[popperRef]} let:open class="cursor-pointer">
    <SelectionButton {label} buttonLabel={selected?.label ?? buttonAllLabel} {buttonClass} {open} />
  </PopoverButton>

  <PopoverPanel use={[[popperContent, popperOptions]]} let:close class="z-50 w-[20rem] max-w-[90vw] rounded border border-contour-weakest bg-surface-base shadow-md">
    <div class="p-3">
      <SearchInput bind:value={term} {placeholder} />
    </div>
    <ul class="max-h-80 overflow-y-auto pb-2">
      {#if !term.trim()}
        <li>
          <button type="button" class="w-full px-4 py-2 text-left text-sm hover:bg-surface-weaker" class:font-semibold={!selected} class:text-theme-base={!selected} on:click={() => pick(undefined, close)}>
            {allLabel}
          </button>
        </li>
      {/if}
      {#each matches as option (option.uid)}
        {@const isSelected = selected?.uid === option.uid}
        <li>
          <button type="button" class="w-full px-4 py-2 text-left text-sm hover:bg-surface-weaker" class:font-semibold={isSelected} class:text-theme-base={isSelected} on:click={() => pick(option, close)}>
            {option.label}
          </button>
        </li>
      {/each}
      {#if !matches.length}
        <li class="px-4 py-2 text-sm text-text-weaker">No country matches “{term}”</li>
      {/if}
    </ul>
  </PopoverPanel>
</Popover>
