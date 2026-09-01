<script>
  import { Popover, PopoverButton, PopoverPanel } from '@rgossiaux/svelte-headlessui';
  import { createPopperActions } from 'svelte-popperjs';
  import Fuse from 'fuse.js';
  import SelectionButton from '$lib/components/controls/components/SelectionButton.svelte';
  import SearchInput from '$lib/components/ui/SearchInput.svelte';

  // A filter-bar dropdown: a list of options in a popover, with a search field
  // when the list is long enough to need one. Where a choice deserves a page of
  // explanation the scoreboard uses explore's modals instead (scenario,
  // indicator) — this is for the choices that are just a list.
  export let label;
  export let options = [];
  // The selected option, or undefined for `allLabel` where there is one.
  export let selected = undefined;
  // An "everything" row at the top of the list, and what the button calls it.
  // Without one the selection is always a single option.
  export let allLabel = undefined;
  export let buttonAllLabel = allLabel;
  // Searching is offered only when there is a placeholder to put in the field.
  export let placeholder = undefined;
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
  $: matches = placeholder && term.trim() ? fuse.search(term).map(({ item }) => item) : options;

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

  <PopoverPanel use={[[popperContent, popperOptions]]} let:close class="z-50 {placeholder ? 'w-[20rem]' : 'w-[14rem]'} max-w-[90vw] rounded border border-contour-weakest bg-surface-base shadow-md">
    {#if placeholder}
      <div class="p-3">
        <SearchInput bind:value={term} {placeholder} />
      </div>
    {/if}
    <ul class="max-h-80 overflow-y-auto py-2">
      {#if allLabel && !term.trim()}
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
        <li class="px-4 py-2 text-sm text-text-weaker">Nothing matches “{term}”</li>
      {/if}
    </ul>
  </PopoverPanel>
</Popover>
