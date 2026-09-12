<script>
  // Cities use canonical labels in selection state and legacy geoIds at the map boundary.
  import { AVOID_CITY_UID, AVOID_GEOGRAPHY_LABEL, AVOID_IS_EMPTY_GEOGRAPHY, AVOID_AVAILABLE_CITIES } from '$stores/avoid-catalog.js';
  import { END_GEO_SHAPE } from '$src/config.js';
  import { writable } from 'svelte/store';
  import { fetchData } from '$lib/api/api';
  import SelectionModal from '$lib/components/controls/components/SelectionModal.svelte';
  import SelectionPanel from '$lib/components/controls/components/SelectionPanel.svelte';
  import SearchInput from '$lib/components/ui/SearchInput.svelte';
  import Geographies from '$lib/components/controls/GeographySelection/Geographies.svelte';
  import Map from '$lib/components/controls/GeographySelection/Map.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';

  export let label = 'Geography';
  export let disabled = undefined;

  const CITY_TYPE = { uid: 'cities', label: 'Cities' };

  let modalOpen = false;
  let hoveredItem;
  let term = '';
  let initialUid;
  let stagedUid;

  $: snapshotOnOpen(modalOpen);
  function snapshotOnOpen(open) {
    if (!open) return;
    initialUid = $AVOID_CITY_UID;
    stagedUid = initialUid;
  }
  $: selectionChanged = modalOpen && stagedUid !== initialUid;
  $: stagedGeography = $AVOID_AVAILABLE_CITIES.find((city) => city.uid === stagedUid);

  function mapGeoId(uid) {
    return $AVOID_AVAILABLE_CITIES.find((city) => city.uid === uid)?.geoId;
  }

  function applyGeography() {
    if (!stagedUid || stagedUid === initialUid) return;
    AVOID_CITY_UID.set(stagedUid);
    modalOpen = false;
  }

  let GEO_SHAPE_DATA = writable({});
  // Cities + country base layers from the legacy API (default fetchData base).
  fetchData(GEO_SHAPE_DATA, [
    { endpoint: END_GEO_SHAPE, params: { 'geography-type': 'admin0' } },
    { endpoint: END_GEO_SHAPE, params: { 'geography-type': 'cities' } },
  ]);
</script>

<SelectionModal
  {label}
  {disabled}
  category="City"
  buttonLabel={$AVOID_GEOGRAPHY_LABEL}
  placeholder={$AVOID_IS_EMPTY_GEOGRAPHY ? 'Select a city' : undefined}
  panelClass="max-w-6xl"
  bind:isOpen={modalOpen}
>
  <SelectionPanel>
    <svelte:fragment slot="header">
      <SearchInput bind:value={term} placeholder="Search geography" class="mb-3" />
    </svelte:fragment>
    <svelte:fragment slot="sidebar">
      <Geographies items={$AVOID_AVAILABLE_CITIES} {term} bind:hoveredItem geographyType={CITY_TYPE} bind:currentUid={stagedUid} />
    </svelte:fragment>
    <svelte:fragment slot="content">
      <div class="px-3 pb-3 w-full flex flex-col min-h-0">
        <div class="flex-1 min-h-0">
          <LoadingWrapper wrapperClass="h-full min-h-72" let:asyncProps={{ geoShape }} asyncProps={{ geoShape: $GEO_SHAPE_DATA }}>
            <Map hovered={mapGeoId(hoveredItem)} baseLayer={geoShape[0].data.data} dataLayer={geoShape[1].data.data} selected={mapGeoId(stagedUid)} />
          </LoadingWrapper>
        </div>
        {#if stagedGeography}
          <div class="mt-3 rounded-lg border border-contour-weakest p-3 text-sm">
            <span class="font-bold text-theme-base">{stagedGeography.label}</span>
            {#if stagedGeography.group}<p class="mt-1 text-xs text-text-weaker">Country: <span class="text-theme-base">{stagedGeography.group}</span></p>{/if}
          </div>
        {/if}
      </div>
    </svelte:fragment>
  </SelectionPanel>

  <div class="flex items-center justify-between gap-3 border-t border-contour-weakest bg-surface-base px-4 py-3">
    <p class="min-w-0 truncate text-sm text-text-weaker">
      {#if stagedGeography}
        <span class="font-medium text-theme-base">{stagedGeography.label}</span> selected
      {:else}
        No city selected yet
      {/if}
    </p>
    {#if selectionChanged}
      <Button variant="primary" class="shrink-0" on:click={applyGeography}>Apply</Button>
    {/if}
  </div>
</SelectionModal>
