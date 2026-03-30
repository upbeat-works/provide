<script>
  import ExpandIcon from '$lib/components/icons/Expand.svelte';

  export let label;
  export let labelClass = '';
  export let buttonLabel;
  export let buttonClass = '';
  export let warning = undefined;
  export let placeholder = undefined;
  export let disabled = undefined;
  export let category = undefined;
  export let open = false;
  export let colors = undefined;

  $: isDisabled = Boolean(disabled);
</script>

<div>
  <span class={`uppercase text-xs tracking-widest font-bold text-contour-weak inline-block ${labelClass}`}>{label}</span>
  <button
    aria-disabled={isDisabled}
    aria-label={disabled ?? warning ?? placeholder ?? `${category ? `${category}:` : ''}${buttonLabel}`}
    disabled={isDisabled}
    on:click
    class={[
      'flex w-full rounded bg-surface-base justify-between truncate transition-colors hover:border-theme-base/40 text-theme-base aria-disabled:cursor-not-allowed',
      buttonClass,
      placeholder || isDisabled ? 'text-theme-weaker' : '',
    ].join(' ')}
  >
    <span class="flex items-center truncate" class:font-bold={!placeholder && !disabled}>
      {#if colors?.length && !disabled && !warning && !placeholder}
        <span class="flex items-center mr-2 shrink-0 mt-0.5">
          {#each colors as color, i}
            <span
              class="inline-block w-3 h-3 rounded-full border-2 border-surface-base"
              style="background:{color}; margin-left:{i > 0 ? '-5px' : '0'}"
            />
          {/each}
        </span>
      {/if}
      {#if disabled || warning || placeholder}
        <span class="leading-tight truncate">{disabled ?? warning ?? placeholder}</span>
      {:else if category}
        <div class="flex items-end gap-x-2">
          <span class="text-theme-weaker text-sm leading-tight pb-0.5 font-normal">{category}</span>
          <span class="leading-tight truncate">{buttonLabel}</span>
        </div>
      {:else}
        <span class="leading-tight truncate">{buttonLabel}</span>
      {/if}
    </span>
    <ExpandIcon class="min-w-[20px] grow-1 stroke-current stroke-[1.5]" isOpen={open} />
  </button>
</div>
