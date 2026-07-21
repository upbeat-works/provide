<script>
  // Duplicated from the shared IndicatorSelection, bound to the isolated AVOID_*
  // stores, with the sector-category pills restored from the legacy `sector`
  // field (Image 1). Shows only the indicators avoid has data for.
  import { AVOID_INDICATOR, AVOID_INDICATOR_LABEL, AVOID_IS_EMPTY_INDICATOR, AVOID_INDICATOR_UID, AVOID_IS_AVAILABLE, AVOID_IS_EMPTY_GEOGRAPHY, AVOID_SELECTION_MODE, AVOID_SECTORS, AVOID_CURRENT_SECTOR, AVOID_SECTOR_INDICATORS } from '$stores/avoid-catalog.js';
  import SelectionModal from '$lib/components/controls/components/SelectionModal.svelte';
  import SelectionPanel from '$lib/components/controls/components/SelectionPanel.svelte';
  import PillGroup from '$lib/components/ui/PillGroup.svelte';
  import SearchInput from '$lib/components/ui/SearchInput.svelte';
  import InteractiveListItem from '$lib/components/ui/InteractiveListItem.svelte';
  import { RadioGroup, RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import { derived } from 'svelte/store';
  import Fuse from 'fuse.js';

  export let label = 'Indicator';

  let modalOpen = false;
  $: if ($AVOID_INDICATOR_UID) modalOpen = false;

  let hoveredItem = null;
  let term = '';
  let listBox;
  $: term, listBox?.scrollTo({ top: 0 });

  // The active sector pill is defaulted/reconciled in the store module.
  $: availableItems = $AVOID_SECTOR_INDICATORS;
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

  let lastHovered = null;
  $: if (hoveredItem) lastHovered = hoveredItem;
  $: detailsItem = availableItems.find((d) => d.uid === (hoveredItem ?? lastHovered)) || $AVOID_INDICATOR;

  const DISABLED = derived([AVOID_IS_EMPTY_GEOGRAPHY, AVOID_SELECTION_MODE], ([$isEmptyGeo, $mode]) => {
    if ($mode === 'geography' && $isEmptyGeo) return 'Select a city first';
    return undefined;
  });
</script>

<SelectionModal
  {label}
  buttonLabel={$AVOID_INDICATOR_LABEL.label}
  warning={!$AVOID_IS_EMPTY_INDICATOR && !$AVOID_IS_AVAILABLE && !$AVOID_IS_EMPTY_GEOGRAPHY ? 'Selected indicator is not available for this city' : undefined}
  disabled={$DISABLED}
  placeholder={$AVOID_IS_EMPTY_INDICATOR ? 'Select an indicator' : undefined}
  bind:isOpen={modalOpen}
>
  <SelectionPanel>
    <svelte:fragment slot="header">
      <SearchInput bind:value={term} placeholder="Search indicators" class="mb-3" />
      {#if $AVOID_SECTORS.length}
        <PillGroup bind:currentUid={$AVOID_CURRENT_SECTOR} options={$AVOID_SECTORS} allowWrap={true} />
      {/if}
    </svelte:fragment>
    <svelte:fragment slot="sidebar">
      <span class="block px-5 pt-4 pb-2 text-xs uppercase tracking-widest text-text-weaker">Indicators</span>
      <div bind:this={listBox}>
        <RadioGroup bind:value={$AVOID_INDICATOR_UID} on:change={(e) => ($AVOID_INDICATOR_UID = e.detail)}>
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
        <div class="p-8">
          <h3 class="font-bold mb-2 text-lg">{detailsItem.label}</h3>
          {#if detailsItem.description}
            <p class="text-text-weaker text-sm">{@html detailsItem.description}</p>
          {/if}
        </div>
      {/if}
    </svelte:fragment>
  </SelectionPanel>
</SelectionModal>
