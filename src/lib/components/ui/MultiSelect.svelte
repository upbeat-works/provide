<script>
  import ExpandIcon from '$lib/components/icons/Expand.svelte';
  import CheckboxInput from './CheckboxInput.svelte';
  import { Popover, PopoverButton, PopoverPanel } from '@rgossiaux/svelte-headlessui';
  import { createPopperActions } from 'svelte-popperjs';

  export let options = []; // [{ value, label }]
  export let selected = []; // bindable array of values
  export let label = undefined;
  export let placeholder = 'ALL';
  export let disabled = false;
  export let wrapperClass = 'border-theme-base/10 hover:bg-surface-base';
  export let labelClass = '';
  export let buttonClass = 'text-theme-base';
  export let panelClass = 'min-w-[220px] max-h-80 overflow-y-auto';

  const [popperRef, popperContent] = createPopperActions();
  const popperOptions = {
    placement: 'bottom-start',
    strategy: 'fixed',
    modifiers: [{ name: 'offset', options: { offset: [0, 10] } }],
  };

  $: buttonLabel = !selected.length
    ? placeholder
    : selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? placeholder)
      : `${selected.length} selected`;

  function toggle(value) {
    selected = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
  }
</script>

<div class="flex gap-2 font-normal transition-colors {wrapperClass}">
  {#if label}
    <span class="uppercase text-xs tracking-widest font-bold text-contour-weak flex items-center {labelClass}" class:text-theme-weaker={disabled}>{label}</span>
  {/if}
  <Popover class="relative">
    <PopoverButton
      use={[popperRef]}
      let:open
      {disabled}
      class={`flex items-center gap-1 text-sm font-bold h-[24px] p-0 bg-transparent cursor-pointer aria-disabled:cursor-not-allowed ${buttonClass}`}
    >
      <span class="truncate">{buttonLabel}</span>
      <ExpandIcon isOpen={open} class="min-w-[20px] shrink-0 stroke-current stroke-[1.5] pointer-events-none" />
    </PopoverButton>
    <PopoverPanel use={[[popperContent, popperOptions]]} class={`${panelClass} bg-surface-base shadow-md z-50 relative rounded border-contour-weakest border py-2`}>
      {#each options as option (option.value)}
        <!-- svelte-ignore a11y-label-has-associated-control -->
        <label class="flex items-center gap-2 px-3 py-1.5 text-sm text-theme-base hover:bg-surface-weaker cursor-pointer">
          <CheckboxInput checked={selected.includes(option.value)} on:change={() => toggle(option.value)} />
          <span class="truncate">{option.label}</span>
        </label>
      {/each}
      {#if !options.length}
        <p class="text-sm text-text-weaker px-3 py-1.5">No options</p>
      {/if}
    </PopoverPanel>
  </Popover>
</div>
