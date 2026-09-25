<script>
  import { createEventDispatcher } from 'svelte';
  import { Popover, PopoverButton, PopoverPanel } from '@rgossiaux/svelte-headlessui';
  import { createPopperActions } from 'svelte-popperjs';
  import Fuse from 'fuse.js';
  import SelectionButton from '$lib/components/controls/components/SelectionButton.svelte';
  import SearchInput from '$lib/components/ui/SearchInput.svelte';

  export let label;
  export let options = [];
  export let selected = undefined;
  export let allLabel = undefined;
  export let buttonAllLabel = allLabel;
  export let placeholder = undefined;
  export let wrapperClass = 'min-w-[10rem]';
  export let buttonClass = 'mt-1 text-sm';
  export let labelClass = '';
  export let panelWidth = undefined;

  // Two-way binding suits a caller holding the choice in local state (the
  // comparison's per-map selectors); `change` suits one that has to act on it —
  // the filter bar puts the scoreboard's selection in the URL.
  const dispatch = createEventDispatcher();

  const [popperRef, popperContent] = createPopperActions();
  const popperOptions = {
    placement: 'bottom-start',
    strategy: 'fixed',
    modifiers: [{ name: 'offset', options: { offset: [0, 10] } }],
  };

  let term = '';

  $: fuse = new Fuse(options, { keys: ['label', 'uid'], threshold: 0.3 });
  $: matches = placeholder && term.trim() ? fuse.search(term).map(({ item }) => item) : options;

  function pick(option, close) {
    selected = option;
    term = '';
    close();
    dispatch('change', option);
  }
</script>

<Popover class={wrapperClass}>
  <!-- SelectionButton contains a button, so the popover trigger must use a div. -->
  <PopoverButton as="div" use={[popperRef]} let:open class="cursor-pointer">
    <SelectionButton
      {label}
      buttonLabel={selected?.label ?? buttonAllLabel}
      buttonAriaLabel="{label}: {selected?.label ?? buttonAllLabel ?? 'none'}"
      {buttonClass}
      {labelClass}
      {open}
    />
  </PopoverButton>

  <PopoverPanel use={[[popperContent, popperOptions]]} let:close class="z-50 {panelWidth ?? (placeholder ? 'w-[20rem]' : 'w-[14rem]')} max-w-[90vw] rounded border border-contour-weakest bg-surface-base shadow-md">
    <slot name="before-search" {close} />
    {#if placeholder}
      <div class="p-3">
        <SearchInput bind:value={term} {placeholder} />
      </div>
    {/if}
    <ul class="max-h-80 overflow-y-auto py-2">
      {#if allLabel && !term.trim()}
        <li>
          <button
            type="button"
            class="w-full px-4 py-2 text-left text-sm hover:bg-surface-weaker"
            class:font-semibold={!selected}
            class:text-theme-base={!selected}
            on:click={() => pick(undefined, close)}
          >
            {allLabel}
          </button>
        </li>
      {/if}
      {#each matches as option (option.uid)}
        {@const isSelected = selected?.uid === option.uid}
        <li>
          <button
            type="button"
            class="w-full px-4 py-2 text-left text-sm hover:bg-surface-weaker"
            class:bg-surface-weaker={isSelected}
            class:font-semibold={isSelected}
            class:text-theme-base={isSelected}
            on:click={() => pick(option, close)}
          >
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
