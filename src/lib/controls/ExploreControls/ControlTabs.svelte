<script>
  import { RadioGroup, RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import Globe from '$lib/helper/icons/Globe.svelte';
  import Chart from '$lib/helper/icons/Chart.svelte';

  export let mode = 'geography';

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

<RadioGroup bind:value={mode} class="flex gap-x-6 border-b border-contour-weakest">
  {#each tabs as { value, label, icon }}
    <RadioGroupOption {value} let:checked class="cursor-pointer">
      <div
        class="flex items-center gap-x-2 pb-3 text-sm font-bold tracking-wider transition-colors border-b-2 -mb-px"
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
