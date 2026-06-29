<script>
  import Geographies from './Geographies.svelte';
  import { CURRENT_GEOGRAPHY_LABEL, AVAILABLE_GEOGRAPHY_TYPES, IS_EMPTY_GEOGRAPHY, CURRENT_GEOGRAPHY_UID, CURRENT_GEOGRAPHY, CURRENT_GEOGRAPHY_TYPE, SELECTION_MODE, AVAILABLE_GEOGRAPHIES_FOR_INDICATOR } from '$stores/state.js';
  import { END_GEO_SHAPE } from '$src/config.js';
  import { writable } from 'svelte/store';
  import { fetchData } from '$lib/api/api';
  import { GEOGRAPHIES, GEOGRAPHY_INDEX } from '$stores/meta.js';
  import { geoIdOf } from './geography-tree.js';
  import SelectionModal from '../components/SelectionModal.svelte';
  import SelectionPanel from '../components/SelectionPanel.svelte';
  import PillGroup from '$lib/components/ui/PillGroup.svelte';
  import SearchInput from '$lib/components/ui/SearchInput.svelte';
  import Map from './Map.svelte';
  import GeoDetailPanel from './GeoDetailPanel.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';

  export let label = 'Geography';

  // Cities are only reachable by drilling into a country, so they are excluded
  // from the top-level type pills (matches the inline-accordion interaction).
  const COUNTRY_SCOPED_TYPES = ['cities'];
  $: pillTypes = geographyTypes.filter((t) => !COUNTRY_SCOPED_TYPES.includes(t.uid));

  // The dialog never closes automatically on selection — the user closes it
  // explicitly. Selecting a country expands its accordion to drill into children,
  // and leaf selections stay put so the choice can be reviewed against the map.
  let modalOpen = false;

  // Snapshot the selection when the dialog opens so we can tell whether the user
  // actually changed it. The confirm button only appears once it differs — with
  // no change there is nothing to confirm.
  let initialGeographyUid;
  $: snapshotOnOpen(modalOpen);
  function snapshotOnOpen(open) {
    if (open) initialGeographyUid = $CURRENT_GEOGRAPHY_UID;
  }
  $: selectionChanged = modalOpen && $CURRENT_GEOGRAPHY_UID !== initialGeographyUid;

  let GEO_SHAPE_DATA = writable({});

  $: geographyTypes = $AVAILABLE_GEOGRAPHY_TYPES;

  let hoveredItem;
  let term = '';
  let currentFilterUid = $CURRENT_GEOGRAPHY_TYPE?.uid; // This stores the currently displayed geography type
  // Default the active tab to the first selectable type (Countries) when nothing
  // is selected yet, so the list isn't empty on first open.
  $: if (!currentFilterUid && pillTypes.length) {
    currentFilterUid = (pillTypes.find((t) => !t.disabled) ?? pillTypes[0]).uid;
  }

  // In indicator-first mode, use geographies filtered by the selected indicator; otherwise show all
  $: geographiesSource = $SELECTION_MODE === 'indicator' ? $AVAILABLE_GEOGRAPHIES_FOR_INDICATOR : $GEOGRAPHIES;

  // currentFilterUid gets updated by the ControlPanel component
  $: selectableGeographies = geographiesSource[currentFilterUid] ?? [];

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

  $: preserveSelectionAcrossTypes(selectableGeographies);

  // When the user toggles the geography type pill, try to keep their selection
  // pointing at the same place under the new type. Ids are globally unique and
  // human-readable (e.g. `Liberia (EEZ)`), so an exact match is the right test;
  // if nothing matches, clear the selection.
  function preserveSelectionAcrossTypes(selectableGeographies) {
    const currentGeography = $CURRENT_GEOGRAPHY;
    if (!currentGeography || !selectableGeographies.length) return;
    const match = selectableGeographies.find((g) => g.uid === currentGeography.uid);
    if (match?.uid) {
      CURRENT_GEOGRAPHY_UID.set(match.uid);
    } else {
      CURRENT_GEOGRAPHY_UID.set(undefined);
    }
  }

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
      <Geographies items={selectableGeographies} {term} bind:hoveredItem geographyType={geographyTypes.find(({ uid }) => uid === currentFilterUid)} bind:currentUid={$CURRENT_GEOGRAPHY_UID} />
    </svelte:fragment>
    <svelte:fragment slot="content">
      <div class="px-3 pb-3 w-full flex flex-col min-h-0">
        <div class="flex-1 min-h-0">
          <LoadingWrapper let:asyncProps={{ geoShape }} asyncProps={{ geoShape: $GEO_SHAPE_DATA }} let:isLoading>
            <Map hovered={geoIdOf($GEOGRAPHY_INDEX, hoveredItem)} baseLayer={geoShape[0].data.data} dataLayer={geoShape[1].data.data} selected={geoIdOf($GEOGRAPHY_INDEX, $CURRENT_GEOGRAPHY_UID)} />
          </LoadingWrapper>
        </div>
        <GeoDetailPanel geography={$CURRENT_GEOGRAPHY} />
      </div>
    </svelte:fragment>
  </SelectionPanel>

  <div class="flex items-center justify-between gap-3 border-t border-contour-weakest bg-surface-base px-4 py-3">
    <p class="min-w-0 truncate text-sm text-text-weaker">
      {#if $CURRENT_GEOGRAPHY}
        <span class="font-medium text-theme-base">{$CURRENT_GEOGRAPHY.label}</span> selected
      {:else}
        No geography selected yet
      {/if}
    </p>
    {#if selectionChanged}
      <Button variant="primary" class="shrink-0" on:click={() => (modalOpen = false)}>Done</Button>
    {/if}
  </div>
</SelectionModal>
