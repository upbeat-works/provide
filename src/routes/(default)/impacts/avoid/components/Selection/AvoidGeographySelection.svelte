<script>
  // Duplicated from the shared GeographySelection, bound to the isolated AVOID_*
  // stores and the frozen legacy cities. Cities-only (no type pills). The legacy
  // city uid IS the geoId the map + geo-shapes key on, so no GEOGRAPHY_INDEX
  // translation is needed.
  import { AVOID_CITY_UID, AVOID_GEOGRAPHY, AVOID_GEOGRAPHY_LABEL, AVOID_IS_EMPTY_GEOGRAPHY, AVOID_AVAILABLE_CITIES } from '$stores/avoid-catalog.js';
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
  $: if (modalOpen) initialUid = initialUid ?? $AVOID_CITY_UID;
  $: if (!modalOpen) initialUid = undefined;
  $: selectionChanged = modalOpen && initialUid !== undefined && $AVOID_CITY_UID !== initialUid;

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
      <Geographies items={$AVOID_AVAILABLE_CITIES} {term} bind:hoveredItem geographyType={CITY_TYPE} bind:currentUid={$AVOID_CITY_UID} />
    </svelte:fragment>
    <svelte:fragment slot="content">
      <div class="px-3 pb-3 w-full flex flex-col min-h-0">
        <div class="flex-1 min-h-0">
          <LoadingWrapper let:asyncProps={{ geoShape }} asyncProps={{ geoShape: $GEO_SHAPE_DATA }}>
            <Map hovered={hoveredItem} baseLayer={geoShape[0].data.data} dataLayer={geoShape[1].data.data} selected={$AVOID_CITY_UID} />
          </LoadingWrapper>
        </div>
        {#if $AVOID_GEOGRAPHY}
          <div class="mt-3 rounded-lg border border-contour-weakest p-3 text-sm">
            <span class="font-bold text-theme-base">{$AVOID_GEOGRAPHY.label}</span>
            {#if $AVOID_GEOGRAPHY.group}<p class="mt-1 text-xs text-text-weaker">Country: <span class="text-theme-base">{$AVOID_GEOGRAPHY.group}</span></p>{/if}
          </div>
        {/if}
      </div>
    </svelte:fragment>
  </SelectionPanel>

  <div class="flex items-center justify-between gap-3 border-t border-contour-weakest bg-surface-base px-4 py-3">
    <p class="min-w-0 truncate text-sm text-text-weaker">
      {#if $AVOID_GEOGRAPHY}
        <span class="font-medium text-theme-base">{$AVOID_GEOGRAPHY.label}</span> selected
      {:else}
        No city selected yet
      {/if}
    </p>
    {#if selectionChanged}
      <Button variant="primary" class="shrink-0" on:click={() => (modalOpen = false)}>Done</Button>
    {/if}
  </div>
</SelectionModal>
