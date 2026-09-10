<script>
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { parseCatalogUrlSelection, parseUrlQuery, urlToState } from '$lib/utils/url';
  import { selectionUrlParams } from '$lib/catalog/selection-url.js';
  import ImpactTime from '$routes/(default)/impacts/explore/components/ImpactTime/ImpactTime.svelte';
  import ImpactGeo from '$routes/(default)/impacts/explore/components/ImpactGeo/ImpactGeo.svelte';
  import UnavoidableRisk from '$routes/(default)/impacts/components/UnavoidableRisk/UnavoidableRisk.svelte';
  import ChartEmbed from '$routes/(default)/projects/eu-scoreboard/components/charts/ChartEmbed.svelte';
  import { EMBED_UID } from '$routes/(default)/projects/eu-scoreboard/components/charts/catalog.js';
  import { IS_STATIC, RUNTIME_CATALOG_SELECTION } from '$stores/state';
  import { catalogFlow } from '$stores/catalog-flow.js';
  import { loadEmbedRuntime } from './embed-runtime.js';
  import Logo from '$lib/components/site/Logo.svelte';

  const embeds = {
    'impact-time': ImpactTime,
    'impact-geo': ImpactGeo,
    'unavoidable-risk': UnavoidableRisk,
    // The scoreboard's charts share one embed; `?chart=<slug>` says which.
    [EMBED_UID]: ChartEmbed,
  };

  let loadedSelection;
  $: loadSelection($page.url);
  $: urlParams = parseUrlQuery($page.url);
  $: componentParams = { ...urlParams, ...selectionUrlParams($RUNTIME_CATALOG_SELECTION) };
  $: component = embeds[$page.params.embed];

  $: $IS_STATIC = urlParams.static;

  function loadSelection(url) {
    if (!browser) return;
    const selection = parseCatalogUrlSelection(url);
    urlToState(url);
    if (!selection.indicator || !selection.instance) return;
    const key = JSON.stringify(selection);
    if (key === loadedSelection) return;
    loadedSelection = key;
    void loadEmbedRuntime(catalogFlow);
  }

  function generateUrl() {
    const url = import.meta.env.VITE_APP_URL;
    if (url) {
      try {
        const host = new URL(url).hostname;
        return {
          url,
          host,
        };
      } catch (error) {
        console.error(error);
        return null;
      }
    }
    console.warn(`APP URL was not set. Will not display link.`);
    return null;
  }

  const url = generateUrl();
</script>

<div class="embed p-6 pb-0">
  <svelte:component this={component} {...componentParams} />
  <div class="flex justify-between text-sm text-contour-weak border-t border-contour-weak pt-3 pb-4">
    <Logo size="sm" color="petrol-800" />
    {#if url}
      <div>
        Visit <a class="text-theme-base" href={url.url}>{url.host}</a> for more information
      </div>
    {/if}
  </div>
</div>
