<script>
  import { goto } from '$app/navigation';
  import { PATH_EXPLORE, PATH_IMPACT, URL_PATH_GEOGRAPHY, URL_PATH_INDICATOR } from '$config';
  import { IS_EMPTY_GEOGRAPHY, IS_EMPTY_INDICATOR, IS_COMBINATION_AVAILABLE_INDICATOR, CURRENT_GEOGRAPHY_UID, CURRENT_INDICATOR_UID } from '$stores/state.js';
  import { buildURL } from '$lib/utils/url.js';
  import { SelectionControls, ControlTabs } from '$lib/components/controls/ExploreControls';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  $: isValidSelection = !$IS_EMPTY_GEOGRAPHY && !$IS_EMPTY_INDICATOR && $IS_COMBINATION_AVAILABLE_INDICATOR;

  function viewResults() {
    const query = buildURL(PATH_IMPACT, {
      [URL_PATH_GEOGRAPHY]: $CURRENT_GEOGRAPHY_UID,
      [URL_PATH_INDICATOR]: $CURRENT_INDICATOR_UID,
    });
    goto(`/${PATH_IMPACT}/${PATH_EXPLORE}${query}`);
  }
</script>

<section class="border-t border-contour-weakest">
  <header class="grid lg:grid-cols-2 gap-x-16 gap-y-4 mb-12 mt-16 px-6">
    <h2 class="text-3xl font-thin text-theme-800 leading-tight max-w-sm">
      From cities to continents: assess climate risk with the Explorer
    </h2>
    <p class="text-sm text-text-weaker leading-relaxed self-end">
      See how different levels of climate action will lead to different climate impacts for countries, cities, and more.
    </p>
  </header>

  <div class="md:pt-16 pb-6 md:pb-12 bg-slate-50 border-t border-contour-weakest">
    <div class="pt-8">
      <div class="mx-auto max-w-7xl px-6">
        <ControlTabs />
      </div>
    </div>
    <hr class="border-t border-contour-weakest" />
    <SelectionControls />
    <div class="flex justify-end mt-8 px-6">
    <Button disabled={!isValidSelection} on:click={viewResults}>
      View results
      <LinkArrow />
    </Button>
    </div>
  </div>
</section>
