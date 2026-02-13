<script>
  import { RadioGroup, RadioGroupOption } from '@rgossiaux/svelte-headlessui';

  export let mode = 'geography';

  const tabs = [
    {
      value: 'geography',
      label: 'BY GEOGRAPHY',
      icon: 'globe',
    },
    {
      value: 'indicator',
      label: 'BY INDICATOR',
      icon: 'chart',
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
        {#if icon === 'globe'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
            <path d="M2 12H22" stroke="currentColor" stroke-width="2" />
            <path d="M12 2C14.5 4.5 16 8 16 12C16 16 14.5 19.5 12 22" stroke="currentColor" stroke-width="2" />
            <path d="M12 2C9.5 4.5 8 8 8 12C8 16 9.5 19.5 12 22" stroke="currentColor" stroke-width="2" />
          </svg>
        {:else if icon === 'chart'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3V21H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M7 14L12 9L16 13L21 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        {/if}
        <span>{label}</span>
      </div>
    </RadioGroupOption>
  {/each}
</RadioGroup>
