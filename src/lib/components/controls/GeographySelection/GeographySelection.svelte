<script>
  import Geographies from './Geographies.svelte';
  import { CURRENT_GEOGRAPHY_LABEL, AVAILABLE_GEOGRAPHY_TYPES, IS_EMPTY_GEOGRAPHY, CURRENT_GEOGRAPHY_UID, CURRENT_GEOGRAPHY, CURRENT_GEOGRAPHY_TYPE, SELECTION_MODE, AVAILABLE_GEOGRAPHIES_FOR_INDICATOR } from '$stores/state.js';
  import { END_GEO_SHAPE } from '$src/config.js';
  import { writable } from 'svelte/store';
  import { fetchData } from '$lib/api/api';
  import { GEOGRAPHIES } from '$stores/meta.js';
<<<<<<<< HEAD:src/lib/components/controls/GeographySelection/GeographySelection.svelte
  import ModalSelect from '$lib/components/ui/ModalSelect.svelte';
  import SelectionButton from '../components/SelectionButton.svelte';
  import SelectionPanel from '../components/SelectionPanel.svelte';
========
  import PopoverSelect from '$lib/components/ui/PopoverSelect/PopoverSelect.svelte';
  import Content from '$lib/components/ui/PopoverSelect/Content.svelte';
>>>>>>>> 9b7f4ffaeb3c1f88818dadd7e699dfa11c579e5c:src/lib/components/controls/ExploreControls/GeographySelection/GeographySelection.svelte
  import Map from './Map.svelte';
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';

  export let label = 'Geography';

  let modalOpen = false;
  $: if ($CURRENT_GEOGRAPHY_UID) modalOpen = false;

  let GEO_SHAPE_DATA = writable({});

  $: geographyTypes = $AVAILABLE_GEOGRAPHY_TYPES;

  let hoveredItem;
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

  $: findSharedId(selectableGeographies);

  function checkIds(geography, id) {
    if (typeof id === 'undefined') {
      return false;
    }
    return geography.uid === id || geography.sharedId === id;
  }

  function findSharedId(selectableGeographies) {
    const currentGeography = $CURRENT_GEOGRAPHY;
    if (currentGeography && selectableGeographies.length) {
      const { uid, sharedId } = currentGeography;
      const possibleMatches = selectableGeographies.filter((geography) => checkIds(geography, uid) || checkIds(geography, sharedId));
      if (possibleMatches.length) {
        // Sort matches by the shortest uid. This should be the country and not some region.
        const bestMatch = possibleMatches.sort((a, b) => a.uid.length - b.uid.length)[0];

        if (bestMatch?.uid) {
          CURRENT_GEOGRAPHY_UID.set(bestMatch.uid);
        }
      } else {
        CURRENT_GEOGRAPHY_UID.set(undefined);
      }
    }
  }
</script>

<ModalSelect panelClass="max-w-4xl" bind:isOpen={modalOpen}>
  <svelte:fragment slot="trigger" let:open let:toggle>
    <SelectionButton
      {label}
      category={$CURRENT_GEOGRAPHY_TYPE?.labelSingular}
      buttonLabel={$CURRENT_GEOGRAPHY_LABEL}
      labelClass="mb-2"
      buttonClass="border-theme-base/20 border rounded-sm p-3"
      placeholder={$IS_EMPTY_GEOGRAPHY ? 'Select a geography' : undefined}
      {open}
      on:click={toggle}
    />
  </svelte:fragment>
  <SelectionPanel filters={geographyTypes} filterKey="geographyType" filterLabel="Pick a location" currentUid={$CURRENT_GEOGRAPHY_UID} items={selectableGeographies} bind:currentFilterUid allowWrap={true}>
    <div slot="items" let:items let:currentFilterUid class="max-w-full grid grid-cols-1 md:grid-cols-[1.5fr_3fr] lg:grid-cols-[1.5fr_3fr]">
      <Geographies {items} bind:hoveredItem geographyType={geographyTypes.find(({ uid }) => uid === currentFilterUid)} bind:currentUid={$CURRENT_GEOGRAPHY_UID} />
      <div class="px-3 hidden md:block">
        <LoadingWrapper let:asyncProps={{ geoShape }} asyncProps={{ geoShape: $GEO_SHAPE_DATA }} let:isLoading>
          <Map hovered={hoveredItem} baseLayer={geoShape[0].data.data} dataLayer={geoShape[1].data.data} selected={$CURRENT_GEOGRAPHY_UID} />
        </LoadingWrapper>
      </div>
    </div>
  </SelectionPanel>
</ModalSelect>
