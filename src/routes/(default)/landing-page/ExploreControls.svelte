<script>
  import { goto } from '$app/navigation';
  import { PATH_EXPLORE, PATH_IMPACT, URL_PATH_GEOGRAPHY, URL_PATH_INDICATOR } from '$config';
  import { IS_EMPTY_GEOGRAPHY, IS_EMPTY_INDICATOR, IS_COMBINATION_AVAILABLE_INDICATOR, CURRENT_GEOGRAPHY_UID, CURRENT_INDICATOR_UID } from '$stores/state.js';
  import { buildURL } from '$lib/utils/url.js';
  import { SelectionControls } from '$lib/controls/MainControls';
  import LinkArrow from '$lib/helper/icons/LinkArrow.svelte';

  $: isValidSelection = !$IS_EMPTY_GEOGRAPHY && !$IS_EMPTY_INDICATOR && $IS_COMBINATION_AVAILABLE_INDICATOR;

  function viewResults() {
    const query = buildURL(PATH_IMPACT, {
      [URL_PATH_GEOGRAPHY]: $CURRENT_GEOGRAPHY_UID,
      [URL_PATH_INDICATOR]: $CURRENT_INDICATOR_UID,
    });
    goto(`/${PATH_EXPLORE}/${PATH_IMPACT}${query}`);
  }
</script>

<section class="border-y border-contour-weakest">
  <header class="grid lg:grid-cols-2 gap-x-24 gap-y-6 mb-12 mt-20 px-12">
    <h2 class="text-3xl font-light text-theme-800 leading-tight">
      From cities to continents: assess climate risk with the Explorer
    </h2>
    <p class="text-md text-text-weaker leading-relaxed self-center">
      See how different levels of climate action will lead to different climate impacts for countries, cities, and more.
    </p>
  </header>

  <div class="bg-surface-weaker rounded-lg p-12">
    <SelectionControls showStepLabels />

    <div class="flex justify-end mt-6">
    <button
      type="button"
      on:click={viewResults}
      disabled={!isValidSelection}
      class="inline-flex items-center gap-x-2 px-6 py-3 rounded font-bold transition-colors"
      class:bg-theme-base={isValidSelection}
      class:text-surface-base={isValidSelection}
      class:hover:bg-theme-stronger={isValidSelection}
      class:bg-contour-weakest={!isValidSelection}
      class:text-text-weaker={!isValidSelection}
      class:cursor-not-allowed={!isValidSelection}
    >
      <span>View results</span>
      <LinkArrow />
    </button>
    </div>
  </div>
</section>
