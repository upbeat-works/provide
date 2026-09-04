<script>
  import { CURRENT_PAGE, IS_COMBINATION_AVAILABLE, IS_EMPTY_SELECTION, CURRENT_GEOGRAPHY_UID, CURRENT_INDICATOR_UID, CURRENT_INDICATOR_OPTION_VALUES, CURRENT_SCENARIOS_UID } from '$stores/state.js';
  import { LEVEL_OF_IMPACT, SELECTED_LIKELIHOOD_LEVEL } from '$stores/avoid.js';
  import { URL_PATH_INDICATOR, URL_PATH_GEOGRAPHY, URL_PATH_SCENARIOS, URL_PATH_LEVEL_OF_IMPACT, URL_PATH_CERTAINTY_LEVEL } from '$config';
  import { buildURL } from '$utils/url.js';
  import tooltip from '$lib/utils/tooltip';
  import copy from 'copy-to-clipboard';
  import { page } from '$app/stores';
  import Link from '$lib/components/icons/Link.svelte';

  $: isDisabled = $IS_EMPTY_SELECTION || !$IS_COMBINATION_AVAILABLE;

  $: query =
    !isDisabled &&
    buildURL($CURRENT_PAGE, {
      [URL_PATH_INDICATOR]: $CURRENT_INDICATOR_UID,
      [URL_PATH_GEOGRAPHY]: $CURRENT_GEOGRAPHY_UID,
      [URL_PATH_SCENARIOS]: $CURRENT_SCENARIOS_UID,
      ...$CURRENT_INDICATOR_OPTION_VALUES,
      [URL_PATH_LEVEL_OF_IMPACT]: $LEVEL_OF_IMPACT,
      [URL_PATH_CERTAINTY_LEVEL]: $SELECTED_LIKELIHOOD_LEVEL,
    });

  function handleClick() {
    if (query) {
      const { origin, pathname } = $page.url;
      if (origin && pathname) {
        copy(`${origin}${pathname}${query}`);
      } else {
        console.warn(`Could not determine origin or pathname.`);
      }
    } else {
      console.warn(`Could not determine query.`);
    }
  }
</script>

<button
  aria-disabled={isDisabled}
  class="flex items-center gap-x-2 text-sm font-bold hover:bg-white rounded-xl transition-colors text-theme-base aria-disabled:hover:bg-transparent aria-disabled:cursor-not-allowed aria-disabled:text-theme-weaker"
  on:click={!isDisabled && handleClick}
  use:tooltip={{ content: isDisabled ? 'Select a geography and indicator first' : 'Click to copy the link to the clipboard' }}
>
  <Link class="h-3" />
  Copy a link to these results<br />
</button>
