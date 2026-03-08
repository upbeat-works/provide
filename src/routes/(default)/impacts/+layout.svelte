<script>
  import { page } from '$app/stores';
  import { urlToState } from '$utils/url';
  import PageHero from '$lib/site/PageHero.svelte';
  import { SelectionControls } from '$lib/controls/ExploreControls';

  $: urlToState($page.url);
</script>

<PageHero label="EXPLORER" title="Future Impacts" description="Explore how different levels of climate action will lead to different climate impacts for countries, cities, and more. See where risk escalates and under what conditions impacts could be avoided." />

<SelectionControls sticky />

<slot />
