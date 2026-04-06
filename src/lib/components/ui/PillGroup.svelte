<script>
  import { RadioGroup, RadioGroupLabel, RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import Info from '$lib/components/icons/Info.svelte';
  import tooltip from '$lib/utils/tooltip';
  export let currentUid;
  export let options;
  export let size = 'md';
  export let disabledMessage = 'Option not available';
  export let allowWrap = false;
  export let label = undefined;

  $: classes = {
    md: {
      group: 'gap-x-2 gap-y-2',
      button: 'py-1.5 px-4 text-sm',
      wrapper: 'gap-x-2',
      label: 'text-sm',
    },
    sm: {
      group: 'gap-1',
      button: 'px-3 py-1.5 text-sm',
      wrapper: 'gap-x-2',
      label: 'text-sm',
    },
  }[size];
</script>

<RadioGroup bind:value={currentUid} on:change={(e) => (currentUid = e.detail)} class="flex {allowWrap ? 'flex-wrap gap-y-2' : ''} {classes.wrapper} {$$props.class}">
  {#if label}
    <RadioGroupLabel class="text-text-weaker font-bold self-center {classes.label}">{label}</RadioGroupLabel>
  {/if}
  {#each options as { uid, disabled, label, tooltip: individualDisabledMessage, count, description }}
    <RadioGroupOption value={uid} let:checked {disabled} class="whitespace-nowrap overflow-hidden cursor-pointer gap-2 {classes.group}">
      <div
        use:tooltip={{ content: disabled ? individualDisabledMessage ?? disabledMessage : undefined }}
        class="w-full flex gap-x-2 leading-tight items-center transition-colors border rounded-full {classes.button}"
        class:bg-theme-base={checked}
        class:text-surface-base={checked}
        class:text-theme-base={!checked}
        class:bg-white={!checked}
        class:cursor-not-allowed={disabled}
        class:opacity-50={disabled}
        class:hover:bg-theme-50={!disabled && !checked}
        class:pr-4={count}
        class:border-theme-base={checked}
      >
        <span class="truncate" title={size === 'sm' ? label : undefined}>{label}</span>
        {#if count}<small class="text-xs font-normal">{count}</small>{/if}
        {#if description}
          <Info isInverted={checked} {description} />
        {/if}
      </div>
    </RadioGroupOption>
  {/each}
</RadioGroup>
