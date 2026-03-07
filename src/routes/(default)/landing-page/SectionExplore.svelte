<script>
  import { goto } from '$app/navigation';
  import { PATH_EXPLORE, PATH_IMPACT, URL_PATH_GEOGRAPHY, URL_PATH_INDICATOR } from '$config';
  import { IS_EMPTY_GEOGRAPHY, IS_EMPTY_INDICATOR, IS_COMBINATION_AVAILABLE_INDICATOR, CURRENT_GEOGRAPHY_UID, CURRENT_INDICATOR_UID } from '$stores/state.js';
  import { buildURL } from '$lib/utils/url.js';
  import { SelectionControls } from '$lib/controls/ExploreControls';
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

<section class="border-t border-contour-weakest">
  <header class="grid lg:grid-cols-2 gap-x-16 gap-y-4 mb-12 mt-16 px-8">
    <h2 class="text-3xl font-thin text-theme-800 leading-tight max-w-sm">
      From cities to continents: assess climate risk with the Explorer
    </h2>
    <p class="text-sm text-text-weaker leading-relaxed self-end">
      See how different levels of climate action will lead to different climate impacts for countries, cities, and more.
    </p>
  </header>

  <div class="pt-16 pb-12 bg-surface-weaker border-t border-contour-weakest">
    <SelectionControls showStepLabels size="md" />

    <div class="flex justify-end mt-8 px-6">
    <button
      type="button"
      on:click={viewResults}
      disabled={!isValidSelection}
      class="inline-flex items-center gap-x-2 px-4 py-2 rounded-sm font-bold text-sm transition-colors"
      class:bg-theme-800={isValidSelection}
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
