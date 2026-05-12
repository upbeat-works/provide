<script>
  import { IS_EMPTY_GEOGRAPHY, CURRENT_INDICATOR, IS_EMPTY_INDICATOR, CURRENT_INDICATOR_UID, AVAILABLE_INDICATORS, SELECTABLE_SECTORS, IS_COMBINATION_AVAILABLE_INDICATOR, SELECTION_MODE } from '$stores/state.js';
  import SelectionModal from './components/SelectionModal.svelte';
  import SelectionPanel from './components/SelectionPanel.svelte';
  import AdvancedFilters from './components/AdvancedFilters.svelte';
  import PillGroup from '$lib/components/ui/PillGroup.svelte';
  import SearchInput from '$lib/components/ui/SearchInput.svelte';
  import InteractiveListItem from '$lib/components/ui/InteractiveListItem.svelte';
  import { RadioGroup, RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import { derived } from 'svelte/store';
  import { onMount } from 'svelte';
  import Fuse from 'fuse.js';

  export let label = 'Indicator';

  let modalOpen = false;
  $: if ($CURRENT_INDICATOR_UID) modalOpen = false;

  let currentFilterUid;
  let hoveredItem = null;
  let term = '';
  let listBox;

  $: currentFilterUid, (term = '');
  $: term, listBox?.scrollTo({ top: 0 });

  onMount(() => {
    const current = $AVAILABLE_INDICATORS.find((d) => d.uid === $CURRENT_INDICATOR_UID);
    currentFilterUid = current?.sector ?? $SELECTABLE_SECTORS.find((s) => !s.disabled)?.uid;
  });

  $: availableItems = currentFilterUid ? $AVAILABLE_INDICATORS.filter((d) => d.sector === currentFilterUid) : $AVAILABLE_INDICATORS;

  $: fuse = new Fuse(availableItems, { includeScore: true, keys: ['label', 'uid'], includeMatches: true });
  $: hasSearchTerm = String(term).trim().length > 0;
  $: searchedItems = !hasSearchTerm
    ? availableItems
    : fuse.search(term).map(({ item, matches }) => {
        let label = item.label;
        const match = matches?.find((m) => m.key === 'label');
        if (match) {
          label = '';
          for (let i = 0; i < match.indices.length; i++) {
            const [start, end] = match.indices[i];
            if (i === 0 && start !== 0) label += item.label.substring(0, start);
            label += `<mark>${item.label.substring(start, end + 1)}</mark>`;
            const nextStart = match.indices[i + 1]?.[0] ?? item.label.length;
            if (end !== item.label.length - 1) label += item.label.substring(end + 1, nextStart);
          }
        }
        return { ...item, label };
      });
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
      <SearchInput bind:value={term} placeholder="Search indicators" class="mb-3" />
      <PillGroup bind:currentUid={currentFilterUid} options={$SELECTABLE_SECTORS} disabledMessage="No indicators available in this sector for this geography" allowWrap={true} />
      <AdvancedFilters />
    </svelte:fragment>
    <svelte:fragment slot="sidebar">
      <span class="block px-5 pt-4 pb-2 text-xs uppercase tracking-widest text-text-weaker">Indicators</span>
      <div bind:this={listBox}>
        <RadioGroup bind:value={$CURRENT_INDICATOR_UID} on:change={(e) => ($CURRENT_INDICATOR_UID = e.detail)}>
          {#if searchedItems.length}
            {#each searchedItems as { icon, uid, label }}
              <RadioGroupOption value={uid} let:checked>
                <InteractiveListItem {icon} {uid} {label} bind:hovered={hoveredItem} selected={checked} />
              </RadioGroupOption>
            {/each}
          {:else}
            <span class="text-xs py-1 px-5 block text-text-weaker" role="status">No indicators found.</span>
          {/if}
        </RadioGroup>
      </div>
    </svelte:fragment>
    <svelte:fragment slot="content">
      {#if detailsItem}
        <div class="p-8 m-4 h-min border rounded-sm border-theme-base/20">
          <h3 class="font-bold mb-2 text-lg">{detailsItem.label}</h3>
          <p class="text-contour-weak text-sm">{@html detailsItem.description || ''}</p>
        </div>
      {/if}
    </svelte:fragment>
  </SelectionPanel>
</SelectionModal>
