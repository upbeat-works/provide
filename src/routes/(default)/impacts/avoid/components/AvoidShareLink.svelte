<script>
  import { AVOID_CITY_UID, AVOID_INDICATOR_UID, AVOID_PARAMS, AVOID_IS_EMPTY, AVOID_IS_AVAILABLE } from '$stores/avoid-catalog.js';
  import { LEVEL_OF_IMPACT, SELECTED_LIKELIHOOD_LEVEL } from '$stores/avoid.js';
  import { PATH_AVOID, URL_PATH_INDICATOR, URL_PATH_GEOGRAPHY, URL_PATH_LEVEL_OF_IMPACT, URL_PATH_CERTAINTY_LEVEL } from '$config';
  import { buildURL } from '$utils/url.js';
  import tooltip from '$lib/utils/tooltip';
  import copy from 'copy-to-clipboard';
  import { page } from '$app/stores';
  import Link from '$lib/components/icons/Link.svelte';

  // Avoid emits its own native LEGACY ids (city uid, sector-prefixed indicator
  // uid, legacy param values). Explore, on arrival, resolves them via translate.js.
  $: isDisabled = $AVOID_IS_EMPTY || !$AVOID_IS_AVAILABLE;

  $: query =
    !isDisabled &&
    buildURL(PATH_AVOID, {
      [URL_PATH_INDICATOR]: $AVOID_INDICATOR_UID,
      [URL_PATH_GEOGRAPHY]: $AVOID_CITY_UID,
      ...$AVOID_PARAMS,
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
  use:tooltip={{ content: isDisabled ? 'Select a city and indicator first' : 'Click to copy the link to the clipboard' }}
>
  <Link class="h-3" />
  Copy a link to these results<br />
</button>
