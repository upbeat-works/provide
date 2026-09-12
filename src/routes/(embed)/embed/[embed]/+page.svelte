<script>
  import { page } from '$app/stores';
  import { getContext } from 'svelte';
  import { embedChartContext, parseEmbedParams } from '$lib/charts/embed-context.js';
  import ImpactTime from '$routes/(default)/impacts/explore/components/ImpactTime/ImpactTime.svelte';
  import ImpactGeo from '$routes/(default)/impacts/explore/components/ImpactGeo/ImpactGeo.svelte';
  import UnavoidableRisk from '$routes/(default)/impacts/components/UnavoidableRisk/UnavoidableRisk.svelte';
  import ChartEmbed from '$routes/(default)/projects/eu-scoreboard/components/charts/ChartEmbed.svelte';
  import { EMBED_UID } from '$routes/(default)/projects/eu-scoreboard/components/charts/catalog.js';
  import Logo from '$lib/components/site/Logo.svelte';

  const embeds = {
    'impact-time': ImpactTime,
    'impact-geo': ImpactGeo,
    'unavoidable-risk': UnavoidableRisk,
    // The scoreboard's charts share one embed; `?chart=<slug>` says which.
    [EMBED_UID]: ChartEmbed,
  };

  const theme = getContext('theme');
  function contextForEmbed(embed, context) {
    if (embed === 'impact-geo') return { ...context, view: context.mapView };
    if (embed === 'unavoidable-risk') return { ...context, view: context.warmingView, unitUid: context.indicatorUnit?.uid };
    return context;
  }
  function paramsForEmbed(embed, params, context) {
    if (embed === EMBED_UID) return { ...params, staticMode: params.static };
    if (embed === 'impact-geo') return { chartContext: context, year: params.year, displayOption: params.displayOption, showSatellite: params.showSatellite };
    if (embed === 'unavoidable-risk') return { chartContext: context, threshold: params.threshold };
    return { chartContext: context };
  }
  $: urlParams = parseEmbedParams($page.url);
  $: baseContext = embedChartContext(urlParams, $theme.color.category);
  $: chartContext = contextForEmbed($page.params.embed, baseContext);
  $: componentParams = paramsForEmbed($page.params.embed, urlParams, chartContext);
  $: component = embeds[$page.params.embed];

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
  {#if component && (chartContext.view.status === 'ready' || $page.params.embed === EMBED_UID)}
    <svelte:component this={component} {...componentParams} />
  {:else}
    <p role="alert">The chart URL is incomplete.</p>
  {/if}
  <div class="flex justify-between text-sm text-contour-weak border-t border-contour-weak pt-3 pb-4">
    <Logo size="sm" color="petrol-800" />
    {#if url}
      <div>
        Visit <a class="text-theme-base" href={url.url}>{url.host}</a> for more information
      </div>
    {/if}
  </div>
</div>
