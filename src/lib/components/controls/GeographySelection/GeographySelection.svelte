<script>
  import Geographies from './Geographies.svelte';
  import { CURRENT_GEOGRAPHY_LABEL, AVAILABLE_GEOGRAPHY_TYPES, IS_EMPTY_GEOGRAPHY, CURRENT_GEOGRAPHY_UID, CURRENT_GEOGRAPHY, CURRENT_GEOGRAPHY_TYPE, SELECTION_MODE, AVAILABLE_GEOGRAPHIES_FOR_INDICATOR } from '$stores/state.js';
  import { END_GEO_SHAPE } from '$src/config.js';
  import { writable } from 'svelte/store';
  import { fetchData } from '$lib/api/api';
  import { GEOGRAPHIES } from '$stores/meta.js';
  import SelectionModal from '../components/SelectionModal.svelte';
  import SelectionPanel from '../components/SelectionPanel.svelte';
  import PillGroup from '$lib/components/ui/PillGroup.svelte';
  import SearchInput from '$lib/components/ui/SearchInput.svelte';
  import Map from './Map.svelte';
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';

  export let label = 'Geography';

  let modalOpen = false;
  $: if ($CURRENT_GEOGRAPHY_UID) modalOpen = false;

  let GEO_SHAPE_DATA = writable({});

  $: geographyTypes = $AVAILABLE_GEOGRAPHY_TYPES;

  let hoveredItem;
  let term = '';
  let currentFilterUid = $CURRENT_GEOGRAPHY_TYPE?.uid; // This stores the currently displayed geography type

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
      <PillGroup bind:currentUid={currentFilterUid} options={geographyTypes} allowWrap={true} />
    </svelte:fragment>
    <svelte:fragment slot="sidebar">
      <Geographies items={selectableGeographies} {term} bind:hoveredItem geographyType={geographyTypes.find(({ uid }) => uid === currentFilterUid)} bind:currentUid={$CURRENT_GEOGRAPHY_UID} />
    </svelte:fragment>
    <svelte:fragment slot="content">
      <div class="px-3 w-full">
        <LoadingWrapper let:asyncProps={{ geoShape }} asyncProps={{ geoShape: $GEO_SHAPE_DATA }} let:isLoading>
          <Map hovered={hoveredItem} baseLayer={geoShape[0].data.data} dataLayer={geoShape[1].data.data} selected={$CURRENT_GEOGRAPHY_UID} />
        </LoadingWrapper>
      </div>
    </svelte:fragment>
  </SelectionPanel>
</SelectionModal>
