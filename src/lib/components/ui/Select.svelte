<script context="module">
  let instance = 0;
</script>

<script>
  import { createEventDispatcher } from 'svelte';
  import Info from '$lib/components/icons/Info.svelte';
  import { IS_STATIC } from '$stores/state';

  export let options = [];
  export let value;
  export let label = undefined;
  export let uid = undefined;
  export let disabled = false;
  export let description = undefined;
  export let wrapperClass = 'border-theme-base/10 hover:bg-surface-base';
  export let labelClass = '';
  export let selectClass = 'bg-transparent text-theme-base';

  const dispatch = createEventDispatcher();

  $: id = uid || `select-${instance}`;

  function handleChange() {
    dispatch('change', { key: id, value });
  }

  instance++;
</script>

{#if !$IS_STATIC}
  <div class="flex gap-2 font-normal transition-colors {wrapperClass}">
    <div class="flex gap-2">
      {#if label}
        <label class="uppercase text-xs tracking-widest font-bold text-contour-weak flex items-center {labelClass}" class:text-theme-weaker={disabled} for={id}>{label}</label>
      {/if}
      {#if description?.length}
        <Info {description} />
      {/if}
    </div>
    <select
      class="text-sm font-bold aria-disabled:cursor-not-allowed h-[24px] -ml-2 cursor-pointer {selectClass}"
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
  </div>
{/if}
