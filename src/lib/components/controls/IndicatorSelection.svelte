<script>
  import {
    IS_EMPTY_GEOGRAPHY,
    CURRENT_GEOGRAPHY_UID,
    CURRENT_INDICATOR,
    IS_EMPTY_INDICATOR,
    AVAILABLE_INDICATORS,
    IS_COMBINATION_AVAILABLE_INDICATOR,
    SELECTION_MODE,
    RUNTIME_CATALOG_SELECTION,
    INDICATOR_INDEX_REQUEST,
    FILTERED_INDICATORS_REQUEST,
    INDICATOR_DETAILS_REQUEST,
    FACET_FILTERS,
  } from '$stores/state.js';
  import SelectionModal from './components/SelectionModal.svelte';
  import SelectionPanel from './components/SelectionPanel.svelte';
  import AdvancedFilters from './components/AdvancedFilters.svelte';
  import SearchInput from '$lib/components/ui/SearchInput.svelte';
  import InteractiveListItem from '$lib/components/ui/InteractiveListItem.svelte';
  import { RadioGroup, RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import { derived } from 'svelte/store';
  import Fuse from 'fuse.js';
  import { indicatorTags } from '$lib/catalog/indicator-tags.js';
  import Button from '$lib/components/ui/Button.svelte';
  import { catalogFlow } from '$stores/catalog-flow.js';
  import { indicatorControlAdapter, indicatorFilterInput, listRequestView } from '$stores/catalog-adapters.js';

  export let label = 'Indicator';
  // Explore narrows the list to what has data for the current geography, and
  // gates itself on a geography being chosen. A view that scopes itself
  // differently (the scoreboard, whose geography is its own) passes the list it
  // wants offered, and owns the gating and availability warning that go with it.
  export let indicatorIndexRequest = undefined;
  export let retryIndicatorIndex = undefined;
  export let disabled = undefined;
  // The control also lives in a page's filter bar, which sets its metrics.
  export let wrapperClass = undefined;
  export let labelClass = 'mb-2';
  export let buttonClass = 'border-theme-base/20 border rounded-sm p-3';

  // Whether the caller brought its own list — and with it, its own gating.
  $: owned = Boolean(indicatorIndexRequest);
  $: available = (indicatorIndexRequest?.data.indicators ?? $AVAILABLE_INDICATORS).map((indicator) => ({
    ...indicator,
    selectionKey: `${indicator.instance}\u0000${indicator.uid}`,
  }));
  $: selectedKey = $RUNTIME_CATALOG_SELECTION.indicator ? `${$RUNTIME_CATALOG_SELECTION.indicator.instance}\u0000${$RUNTIME_CATALOG_SELECTION.indicator.id}` : undefined;

  let modalOpen = false;
  let stagedSelectionKey;
  $: if (!modalOpen) stagedSelectionKey = selectedKey;

  let hoveredItem = null;
  let term = '';
  let listBox;

  $: (term, listBox?.scrollTo({ top: 0 }));

  // Sectors are no longer a convention facet, so the list shows all indicators
  // available for the geography (search narrows them).
  $: availableItems = available;

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
  $: current = available.find((item) => item.selectionKey === selectedKey);
  $: staged = available.find((item) => item.selectionKey === stagedSelectionKey);
  $: selectionChanged = modalOpen && Boolean(stagedSelectionKey) && stagedSelectionKey !== selectedKey;
  // Keep showing the last hovered item so the detail panel doesn't flicker
  // (appear/disappear) as the pointer crosses the gap between rows — InteractiveListItem
  // clears `hoveredItem` on mouseleave, which would otherwise blank the panel.
  let lastHovered = null;
  $: if (hoveredItem) lastHovered = hoveredItem;
  $: detailsItem = available.find((item) => item.selectionKey === (hoveredItem ?? lastHovered)) || staged || current;

  $: filterContext = {
    mode: $SELECTION_MODE,
    geography: $CURRENT_GEOGRAPHY_UID,
    filters: $FACET_FILTERS,
  };
  $: filterInput = indicatorFilterInput(filterContext);
  $: control = indicatorControlAdapter({
    ownedRequest: indicatorIndexRequest,
    context: filterContext,
    indexRequest: $INDICATOR_INDEX_REQUEST,
    filteredRequest: $FILTERED_INDICATORS_REQUEST,
  });
  $: if (control.syncContext) syncFilters(control.syncContext);
  $: listView = listRequestView({ request: control.request, items: searchedItems });

  function syncFilters(context) {
    if (!context) return;
    void catalogFlow.syncIndicatorScope(context);
  }

  function retryIndicators() {
    if (owned) {
      retryIndicatorIndex?.();
      return;
    }
    if (filterInput) {
      void catalogFlow.retryIndicatorScope(filterContext);
      return;
    }
    void catalogFlow.catalog.loadIndicatorIndex();
  }

  function applyIndicator() {
    const indicator = available.find((item) => item.selectionKey === stagedSelectionKey);
    if (!indicator) return;
    modalOpen = false;
    void catalogFlow.chooseIndicator({ id: indicator.uid, instance: indicator.instance }, { history: 'push' });
  }

  const DISABLED = derived([IS_EMPTY_GEOGRAPHY, SELECTION_MODE], ([$isEmptyGeography, $mode]) => {
    if ($mode === 'geography' && $isEmptyGeography) {
      return 'Select a geography first';
    }
    return undefined;
  });
</script>

<SelectionModal
  {label}
  buttonLabel={current?.label ?? $CURRENT_INDICATOR?.label}
  warning={!owned && !$IS_EMPTY_INDICATOR && !$IS_COMBINATION_AVAILABLE_INDICATOR && !$IS_EMPTY_GEOGRAPHY ? 'Selected indicator is not available for this geography' : undefined}
  disabled={disabled ?? (owned ? undefined : $DISABLED)}
  placeholder={$IS_EMPTY_INDICATOR ? 'Select an indicator' : undefined}
  {wrapperClass}
  {labelClass}
  {buttonClass}
  bind:isOpen={modalOpen}
>
  <SelectionPanel>
    <svelte:fragment slot="header">
      <SearchInput bind:value={term} placeholder="Search indicators" class="mb-3" />
      {#if control.showAdvancedFilters}
        <AdvancedFilters />
      {/if}
      {#if listView.hasPartialFailure}
        <Button variant="secondary" disabled={owned && !control.ownedRetryAvailable} on:click={retryIndicators}>Retry missing sources</Button>
      {/if}
      {#if control.ownedRetryStatus === 'loading'}
        <p class="mt-2 text-sm" role="status">Refreshing indicators…</p>
      {:else if control.ownedRetryStatus === 'failure'}
        <p class="mt-2 text-sm" role="alert">Could not refresh indicators.</p>
      {/if}
    </svelte:fragment>
    <svelte:fragment slot="sidebar">
      <span class="block px-5 pt-4 pb-2 text-xs uppercase tracking-widest text-text-weaker">Indicators</span>
      <div bind:this={listBox}>
        {#if listView.status === 'loading'}
          <span class="text-xs py-1 px-5 block text-text-weaker" role="status">Loading indicators…</span>
        {:else if listView.status === 'failure'}
          <div class="px-5 py-2">
            <Button variant="secondary" on:click={retryIndicators}>Retry indicators</Button>
          </div>
        {:else}
          <RadioGroup bind:value={stagedSelectionKey}>
            {#if listView.status === 'ready'}
              {#each searchedItems as { icon, uid, label, selectionKey }}
                <RadioGroupOption value={selectionKey} let:checked>
                  <InteractiveListItem {icon} uid={selectionKey} {label} bind:hovered={hoveredItem} selected={checked} />
                </RadioGroupOption>
              {/each}
            {:else}
              <span class="text-xs py-1 px-5 block text-text-weaker" role="status">No indicators found.</span>
            {/if}
          </RadioGroup>
        {/if}
      </div>
    </svelte:fragment>
    <svelte:fragment slot="content">
      {#if detailsItem}
        {@const tags = indicatorTags(detailsItem)}
        <!-- min-w-0 lets this shrink inside the flex parent; without it the
             widest line sets the panel width and scrolls it sideways. -->
        <div class="p-8 min-w-0 w-full">
          <h3 class="font-bold mb-2 text-lg text-theme-stronger break-words">{detailsItem.label}</h3>
          {#if detailsItem.description}
            <p class="text-theme-base text-sm break-words">{@html detailsItem.description}</p>
          {/if}
          {#if current?.selectionKey === detailsItem.selectionKey && $INDICATOR_DETAILS_REQUEST.status === 'loading'}
            <p class="mt-4 text-sm" role="status">Loading details…</p>
          {:else if current?.selectionKey === detailsItem.selectionKey && $INDICATOR_DETAILS_REQUEST.status === 'failure'}
            <Button class="mt-4" variant="secondary" on:click={() => catalogFlow.retryIndicatorDetails()}>Retry details</Button>
          {/if}
          {#if tags.length}
            <p class="mt-4 text-sm font-bold text-theme-stronger break-words">
              {#each tags as tag, i}{tag}{#if i < tags.length - 1}<span class="mx-1.5">·</span>{/if}{/each}
            </p>
          {/if}
        </div>
      {/if}
    </svelte:fragment>
  </SelectionPanel>

  <div class="flex items-center justify-between gap-3 border-t border-contour-weakest bg-surface-base px-4 py-3">
    <p class="min-w-0 truncate text-sm text-text-weaker">
      {#if staged}
        <span class="font-medium text-theme-base">{staged.label}</span> selected
      {:else}
        No indicator selected yet
      {/if}
    </p>
    {#if selectionChanged}
      <Button variant="primary" class="shrink-0" on:click={applyIndicator}>Apply</Button>
    {/if}
  </div>
</SelectionModal>
