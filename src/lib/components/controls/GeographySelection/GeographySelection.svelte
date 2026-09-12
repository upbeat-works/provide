<script>
  import Geographies from './Geographies.svelte';
  import {
    CURRENT_GEOGRAPHY_LABEL,
    AVAILABLE_GEOGRAPHY_TYPES,
    IS_EMPTY_GEOGRAPHY,
    CURRENT_GEOGRAPHY_UID,
    CURRENT_GEOGRAPHY_TYPE,
    SELECTION_MODE,
    AVAILABLE_GEOGRAPHIES_FOR_INDICATOR,
    GEOGRAPHY_INDEX_REQUEST,
    GEOGRAPHY_AVAILABILITY_REQUEST,
    RUNTIME_CATALOG_SELECTION,
    PENDING_CATALOG_SELECTION,
  } from '$stores/state.js';
  import { END_GEO_SHAPE } from '$src/config.js';
  import { writable } from 'svelte/store';
  import { fetchData } from '$lib/api/api';
  import { GEOGRAPHIES, GEOGRAPHY_INDEX } from '$stores/meta.js';
  import { geoIdOf, plainLabel } from './geography-tree.js';
  import SelectionModal from '../components/SelectionModal.svelte';
  import SelectionPanel from '../components/SelectionPanel.svelte';
  import PillGroup from '$lib/components/ui/PillGroup.svelte';
  import SearchInput from '$lib/components/ui/SearchInput.svelte';
  import Map from './Map.svelte';
  import GeoDetailPanel from './GeoDetailPanel.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';
  import { catalogFlow } from '$stores/catalog-flow.js';
  import { geographyControlView, geographyListRequest } from '$stores/catalog-adapters.js';

  export let label = 'Geography';

  // Cities are only reachable by drilling into a country, so they are excluded
  // from the top-level type pills (matches the inline-accordion interaction).
  const COUNTRY_SCOPED_TYPES = ['cities'];
  // The parenthetical abbreviation ("River Basins (RB)") earns its space in the
  // collapsed selection button, not in a row of browse filters.
  $: pillTypes = geographyTypes.filter((t) => !COUNTRY_SCOPED_TYPES.includes(t.uid)).map((t) => ({ ...t, label: plainLabel(t.label) }));

  let modalOpen = false;
  let stagedGeographyUid;
  function chooseGeography(uid) {
    if (!uid) return;
    stagedGeographyUid = uid;
  }

  function applyGeography() {
    if (!stagedGeographyUid || stagedGeographyUid === initialGeographyUid) return;
    modalOpen = false;
    void catalogFlow.chooseGeography(stagedGeographyUid, { history: 'push' });
  }

  // Snapshot the selection when the dialog opens so we can tell whether the user
  // actually changed it. The confirm button only appears once it differs — with
  // no change there is nothing to confirm.
  let initialGeographyUid;
  $: snapshotOnOpen(modalOpen);
  function snapshotOnOpen(open) {
    if (!open) return;
    initialGeographyUid = $CURRENT_GEOGRAPHY_UID;
    stagedGeographyUid = initialGeographyUid;
    // Open on the tab that holds the current selection, so it is visible (and
    // highlighted) rather than the user landing on Countries every time. Cities
    // have no pill of their own — they live inside the country accordion — so
    // they fall through to the default below.
    const type = $CURRENT_GEOGRAPHY_TYPE?.uid;
    if (type && pillTypes.some((t) => t.uid === type && !t.disabled)) currentFilterUid = type;
  }
  $: selectionChanged = modalOpen && stagedGeographyUid !== initialGeographyUid;
  $: stagedGeography = stagedGeographyUid ? $GEOGRAPHY_INDEX.byId[stagedGeographyUid] : undefined;

  let GEO_SHAPE_DATA = writable({});

  $: geographyTypes = $AVAILABLE_GEOGRAPHY_TYPES;

  let hoveredItem;
  let term = '';
  let currentFilterUid = $CURRENT_GEOGRAPHY_TYPE?.uid;
  // Default the active tab to the first selectable type (Countries) when nothing
  // is selected yet, so the list isn't empty on first open.
  $: if (!currentFilterUid && pillTypes.length) {
    currentFilterUid = (pillTypes.find((t) => !t.disabled) ?? pillTypes[0]).uid;
  }

  $: geographiesSource = $SELECTION_MODE === 'indicator' ? $AVAILABLE_GEOGRAPHIES_FOR_INDICATOR : $GEOGRAPHIES;

  $: selectableGeographies = geographiesSource[currentFilterUid] ?? [];
  $: listRequest = geographyListRequest({
    mode: $SELECTION_MODE,
    selection: $RUNTIME_CATALOG_SELECTION,
    indexRequest: $GEOGRAPHY_INDEX_REQUEST,
    availabilityRequest: $GEOGRAPHY_AVAILABILITY_REQUEST,
  });
  $: usingAvailability = listRequest === $GEOGRAPHY_AVAILABILITY_REQUEST;
  $: controlView = geographyControlView({
    selection: $RUNTIME_CATALOG_SELECTION,
    pendingSelection: $PENDING_CATALOG_SELECTION,
    request: listRequest,
    items: selectableGeographies,
  });
  $: listView = controlView.list;

  function retryGeographies() {
    if (usingAvailability) {
      void catalogFlow.catalog.loadGeographyAvailability();
      return;
    }
    void catalogFlow.catalog.loadGeographyIndex();
  }

  $: currentFilterUid &&
    fetchData(GEO_SHAPE_DATA, [
      {
        endpoint: END_GEO_SHAPE,
        params: {
          'geography-type': 'admin0',
        },
      },
      {
        endpoint: END_GEO_SHAPE,
        params: {
          'geography-type': currentFilterUid,
        },
      },
    ]);

</script>

<SelectionModal
  {label}
  category={$CURRENT_GEOGRAPHY_TYPE?.labelSingular}
  buttonLabel={$CURRENT_GEOGRAPHY_LABEL}
  placeholder={$IS_EMPTY_GEOGRAPHY ? 'Select a geography' : undefined}
  panelClass="max-w-6xl"
  bind:isOpen={modalOpen}
>
  <SelectionPanel>
    <svelte:fragment slot="header">
      <SearchInput bind:value={term} placeholder="Search geography" class="mb-3" />
      <PillGroup bind:currentUid={currentFilterUid} options={pillTypes} allowWrap={true} />
    </svelte:fragment>
    <svelte:fragment slot="sidebar">
      {#if listView.status === 'loading'}
        <span class="text-xs py-4 px-5 block text-text-weaker" role="status">Loading geographies…</span>
      {:else if listView.status === 'failure'}
        <div class="px-5 py-3">
          <Button variant="secondary" on:click={retryGeographies}>Retry geographies</Button>
        </div>
      {:else if listView.status === 'empty'}
        <span class="text-xs py-4 px-5 block text-text-weaker" role="status">Could not find any geographies for this type.</span>
      {:else}
        <Geographies
          items={selectableGeographies}
          {term}
          bind:hoveredItem
          geographyType={geographyTypes.find(({ uid }) => uid === currentFilterUid)}
          bind:currentUid={stagedGeographyUid}
        />
      {/if}
    </svelte:fragment>
    <svelte:fragment slot="content">
      <div class="px-3 pb-3 w-full flex flex-col min-h-0">
        <div class="flex-1 min-h-0">
          <LoadingWrapper wrapperClass="h-full min-h-72" let:asyncProps={{ geoShape }} asyncProps={{ geoShape: $GEO_SHAPE_DATA }} let:isLoading>
            <Map hovered={geoIdOf($GEOGRAPHY_INDEX, hoveredItem)} baseLayer={geoShape[0].data.data} dataLayer={geoShape[1].data.data} selected={geoIdOf($GEOGRAPHY_INDEX, stagedGeographyUid)} />
          </LoadingWrapper>
        </div>
        <GeoDetailPanel geography={stagedGeography} on:select={(event) => chooseGeography(event.detail)} />
      </div>
    </svelte:fragment>
  </SelectionPanel>

  <div class="flex items-center justify-between gap-3 border-t border-contour-weakest bg-surface-base px-4 py-3">
    <p class="min-w-0 truncate text-sm text-text-weaker">
      {#if stagedGeography}
        <span class="font-medium text-theme-base">{stagedGeography.label}</span> selected
      {:else}
        No geography selected yet
      {/if}
    </p>
    {#if selectionChanged}
      <Button variant="primary" class="shrink-0" on:click={applyGeography}>Apply</Button>
    {/if}
  </div>
</SelectionModal>
