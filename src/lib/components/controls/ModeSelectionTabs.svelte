<script>
  import { RadioGroup, RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import Globe from '$lib/components/icons/Globe.svelte';
  import Chart from '$lib/components/icons/Chart.svelte';
  import { SELECTION_MODE } from '$stores/state.js';

  const tabs = [
    {
      value: 'geography',
      label: 'BY GEOGRAPHY',
      icon: Globe,
    },
    {
      value: 'indicator',
      label: 'BY INDICATOR',
      icon: Chart,
    },
  ];
</script>

<RadioGroup bind:value={$SELECTION_MODE} class="flex gap-x-6">
  {#each tabs as { value, label, icon }}
    <RadioGroupOption {value} let:checked class="cursor-pointer">
      <div
        class="flex items-center gap-x-2 pb-3 text-xs font-semibold tracking-wider transition-colors border-b-2 -mb-px"
        class:border-theme-base={checked}
        class:text-theme-base={checked}
        class:border-transparent={!checked}
        class:text-text-weaker={!checked}
        class:hover:text-theme-base={!checked}
      >
        <svelte:component this={icon} />
        <span>{label}</span>
      </div>
    </RadioGroupOption>
  {/each}
</RadioGroup>
