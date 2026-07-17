<script context="module">
  let instance = 0;
</script>

<script>
  import { createEventDispatcher } from 'svelte';
  import Info from '$lib/components/icons/Info.svelte';
  import Expand from '$lib/components/icons/Expand.svelte';
  import { IS_STATIC } from '$stores/state';

  export let options = [];
  export let value;
  export let label = undefined;
  export let uid = undefined;
  export let disabled = false;
  export let description = undefined;
  export let boxed = false;
  export let wrapperClass = 'border-theme-base/10 hover:bg-surface-base';
  export let labelClass = '';
  export let selectClass = boxed ? 'bg-transparent text-theme-base appearance-none pr-1' : 'bg-transparent text-theme-base';
  export let boxClass = 'border border-theme-base/20 rounded-sm bg-white px-3 py-1.5';

  const dispatch = createEventDispatcher();

  $: id = uid || `select-${instance}`;

  function handleChange() {
    dispatch('change', { key: id, value });
  }

  instance++;
</script>

{#if !$IS_STATIC}
  <div class="flex gap-2 font-normal items-center transition-colors {wrapperClass}">
    <div class="flex gap-2">
      {#if label}
        <label class="uppercase text-xs tracking-widest font-bold text-contour-weak flex items-center {labelClass}" class:text-theme-weaker={disabled} for={id}>{label}</label>
      {/if}
      {#if description?.length}
        <Info {description} />
      {/if}
    </div>
    <div class="flex items-center gap-1 {boxed ? boxClass : ''}">
      <select
        class="text-sm font-bold aria-disabled:cursor-not-allowed h-[24px] cursor-pointer {boxed ? '' : '-ml-2'} {selectClass}"
        class:text-theme-weaker={disabled}
        aria-disabled={disabled}
        {disabled}
        {id}
        bind:value
        on:change={handleChange}
      >
        {#each options as option}
          <option value={option.value ?? option.uid}>{option.labelLong || option.label}</option>
        {/each}
      </select>
      {#if boxed}
        <Expand isOpen={false} class="w-4 h-4 stroke-current stroke-[1.5] pointer-events-none text-theme-base flex-shrink-0" />
      {/if}
    </div>
  </div>
{/if}
