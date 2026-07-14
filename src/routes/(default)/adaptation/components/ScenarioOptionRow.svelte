<script>
  import CheckboxInput from '$lib/components/ui/CheckboxInput.svelte';

  export let option;
  export let isSelected;
  export let isDisabled;
  export let isHovered;
  export let onToggle;
  export let onHover;
</script>

<!-- svelte-ignore a11y-label-has-associated-control -->
<label
  class="transition-colors text-sm pl-4 pr-2 py-1.5 grid grid-cols-[auto_1fr] gap-x-2 items-center cursor-pointer aria-disabled:text-contour-weakest aria-disabled:cursor-not-allowed"
  class:bg-surface-weaker={isHovered}
  aria-disabled={isDisabled}
  on:mouseover={onHover}
  on:focus={onHover}
>
  <CheckboxInput checked={isSelected} disabled={isDisabled} on:change={onToggle} />
  <span class="transition-colors" class:font-bold={isSelected} class:text-theme-base={isSelected}>{option.label}</span>
</label>
