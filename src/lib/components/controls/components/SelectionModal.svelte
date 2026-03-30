<script>
  import ModalSelect from '$lib/components/ui/ModalSelect.svelte';
  import SelectionButton from './SelectionButton.svelte';

  export let label;
  export let buttonLabel = undefined;
  export let category = undefined;
  export let buttonClass = 'border-theme-base/20 border rounded-sm p-3';
  export let labelClass = 'mb-2';
  export let warning = undefined;
  export let disabled = undefined;
  export let placeholder = undefined;
  export let panelClass = 'max-w-3xl';
  export let isOpen = false;
  export let colors = undefined;
</script>

<ModalSelect {panelClass} bind:isOpen>
  <svelte:fragment slot="trigger" let:open let:toggle>
    <SelectionButton
      {label}
      {buttonLabel}
      {category}
      {buttonClass}
      {labelClass}
      {warning}
      {disabled}
      {placeholder}
      {colors}
      {open}
      on:click={toggle}
    />
  </svelte:fragment>
  <slot />
</ModalSelect>
