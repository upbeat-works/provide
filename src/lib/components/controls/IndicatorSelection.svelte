<script>
  import { IS_EMPTY_GEOGRAPHY, CURRENT_INDICATOR, IS_EMPTY_INDICATOR, CURRENT_INDICATOR_UID, AVAILABLE_INDICATORS, SELECTABLE_SECTORS, IS_COMBINATION_AVAILABLE_INDICATOR, SELECTION_MODE } from '$stores/state.js';
  import SelectionModal from './components/SelectionModal.svelte';
  import SelectionPanel from './components/SelectionPanel.svelte';
  import PillGroup from '$lib/components/ui/PillGroup.svelte';
  import InteractiveListItem from '$lib/components/ui/InteractiveListItem.svelte';
  import { RadioGroup, RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import { derived } from 'svelte/store';
  import { onMount } from 'svelte';

  export let label = 'Indicator';

  let modalOpen = false;
  $: if ($CURRENT_INDICATOR_UID) modalOpen = false;

  let currentFilterUid;
  let hoveredItem = null;

  onMount(() => {
    const current = $AVAILABLE_INDICATORS.find((d) => d.uid === $CURRENT_INDICATOR_UID);
    currentFilterUid = current?.sector ?? $SELECTABLE_SECTORS.find((s) => !s.disabled)?.uid;
  });

  $: availableItems = currentFilterUid ? $AVAILABLE_INDICATORS.filter((d) => d.sector === currentFilterUid) : $AVAILABLE_INDICATORS;
  $: current = $AVAILABLE_INDICATORS.find((d) => d.uid === $CURRENT_INDICATOR_UID);
  $: detailsItem = $AVAILABLE_INDICATORS.find((d) => d.uid === hoveredItem) || current;

  const DISABLED = derived([IS_EMPTY_GEOGRAPHY, SELECTION_MODE], ([$isEmptyGeography, $mode]) => {
    if ($mode === 'geography' && $isEmptyGeography) {
      return 'Select a geography first';
    }
    return undefined;
  });
</script>

<SelectionModal
  {label}
  buttonLabel={$CURRENT_INDICATOR?.label}
  warning={!$IS_EMPTY_INDICATOR && !$IS_COMBINATION_AVAILABLE_INDICATOR && !$IS_EMPTY_GEOGRAPHY ? 'Selected indicator is not available for this geography' : undefined}
  disabled={$DISABLED}
  placeholder={$IS_EMPTY_INDICATOR ? 'Select an indicator' : undefined}
  bind:isOpen={modalOpen}
>
  <SelectionPanel>
    <svelte:fragment slot="header">
      <span class="block text-xs uppercase tracking-widest text-theme-weaker mb-2">Pick a sector</span>
      <PillGroup bind:currentUid={currentFilterUid} options={$SELECTABLE_SECTORS} disabledMessage="No indicators available in this sector for this geography" allowWrap={true} />
    </svelte:fragment>
    <svelte:fragment slot="sidebar">
      <span class="block px-5 pt-4 pb-2 text-xs uppercase tracking-widest text-text-weaker">Indicators</span>
      <RadioGroup bind:value={$CURRENT_INDICATOR_UID} on:change={(e) => ($CURRENT_INDICATOR_UID = e.detail)}>
        {#if availableItems.length}
          {#each availableItems as { icon, uid, label }}
            <RadioGroupOption value={uid} let:checked>
              <InteractiveListItem {icon} {uid} {label} bind:hovered={hoveredItem} selected={checked} />
            </RadioGroupOption>
          {/each}
        {:else}
          <span class="text-xs py-1 px-5 block text-text-weaker" role="status">No indicators available.</span>
        {/if}
      </RadioGroup>
    </svelte:fragment>
    <svelte:fragment slot="content">
      {#if detailsItem}
        <div class="p-8 m-4 h-min border rounded-sm border-theme-base/20">
          <h3 class="font-bold mb-2">{detailsItem.label}</h3>
          <p class="text-contour-weak">{@html detailsItem.description || ''}</p>
        </div>
      {/if}
    </svelte:fragment>
  </SelectionPanel>
</SelectionModal>
