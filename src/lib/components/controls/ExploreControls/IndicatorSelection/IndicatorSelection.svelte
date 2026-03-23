<script>
  import { IS_EMPTY_GEOGRAPHY, CURRENT_INDICATOR, IS_EMPTY_INDICATOR, CURRENT_INDICATOR_UID, AVAILABLE_INDICATORS, SELECTABLE_SECTORS, IS_COMBINATION_AVAILABLE_INDICATOR, SELECTION_MODE } from '$stores/state.js';
  import ModalSelect from '$lib/components/ui/ModalSelect.svelte';
  import SelectionButton from '../SelectionButton.svelte';
  import ControlPanel from '$lib/components/controls/ControlPanel.svelte';
  import { derived } from 'svelte/store';

  export let label = 'Indicator';

  let modalOpen = false;
  $: if ($CURRENT_INDICATOR_UID) modalOpen = false;

  let currentFilterUid;

  const DISABLED = derived([IS_EMPTY_GEOGRAPHY, SELECTION_MODE], ([$isEmptyGeography, $mode]) => {
    if ($mode === 'geography' && $isEmptyGeography) {
      return 'Select a geography first';
    }
    return undefined;
  });
</script>

<ModalSelect panelClass="max-w-3xl" bind:isOpen={modalOpen}>
  <svelte:fragment slot="trigger" let:open let:toggle>
    <SelectionButton
      {label}
      buttonLabel={$CURRENT_INDICATOR?.label}
      buttonClass="border-theme-base/20 border rounded-sm p-3"
      labelClass="mb-2"
      warning={!$IS_EMPTY_INDICATOR && !$IS_COMBINATION_AVAILABLE_INDICATOR && !$IS_EMPTY_GEOGRAPHY ? 'Selected indicator is not available for this geography' : undefined}
      disabled={$DISABLED}
      placeholder={$IS_EMPTY_INDICATOR ? 'Select an indicator' : undefined}
      {open}
      on:click={toggle}
    />
  </svelte:fragment>
  <ControlPanel
    filters={$SELECTABLE_SECTORS}
    filterKey="sector"
    filterLabel="Pick a sector"
    bind:currentUid={$CURRENT_INDICATOR_UID}
    disabledMessage="No indicators available in this sector for this geography"
    bind:currentFilterUid
    items={$AVAILABLE_INDICATORS}
    itemsLabel="Indicators"
    allowWrap={true}
  />
</ModalSelect>
