<script>
  import { page } from '$app/stores';
  import { getContext } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { embedChartContext, parseEmbedParams } from '$lib/charts/embed-context.js';
  import ImpactTime from '$routes/(default)/impacts/explore/components/ImpactTime/ImpactTime.svelte';
  import ImpactGeo from '$routes/(default)/impacts/explore/components/ImpactGeo/ImpactGeo.svelte';
  import UnavoidableRisk from '$routes/(default)/impacts/components/UnavoidableRisk/UnavoidableRisk.svelte';
  import ChartEmbed from '$routes/(default)/impacts/eu-scoreboard/components/charts/ChartEmbed.svelte';
  import { EMBED_UID } from '$routes/(default)/impacts/eu-scoreboard/components/charts/catalog.js';
  import Logo from '$lib/components/site/Logo.svelte';

  export let data = {};

  const embeds = {
    'impact-time': ImpactTime,
    'impact-geo': ImpactGeo,
    'unavoidable-risk': UnavoidableRisk,
    [EMBED_UID]: ChartEmbed,
  };

  const theme = getContext('theme');
  function contextForEmbed(embed, context) {
    if (embed === 'impact-geo') return { ...context, view: context.mapView, availableYears: context.mapView.years ?? [] };
    if (embed === 'unavoidable-risk') return { ...context, view: context.warmingView, unitUid: context.indicatorUnit?.uid };
    return context;
  }
  function paramsForEmbed(embed, params, context) {
    if (embed === EMBED_UID) {
      return {
        result: data.scoreboardChart,
        selection: data.selection,
        staticMode: params.static,
      };
    }
    if (embed === 'impact-geo') return { chartContext: context, year: params.year, displayOption: params.displayOption, showSatellite: params.showSatellite, retryAvailability: invalidateAll };
    if (embed === 'unavoidable-risk') return { chartContext: context, threshold: params.threshold };
    return { chartContext: context };
  }
  $: urlParams = parseEmbedParams($page.url);
  // Set by case-study live-chart blocks: the chart sits inside a PROVIDE page, so skip the branding footer.
  $: inline = $page.url.searchParams.get('inline') === 'true';
  $: baseContext = embedChartContext(urlParams, $theme.color.category);
  $: if ($page.params.embed === 'impact-geo' && data.mapView) baseContext.mapView = data.mapView;
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

<!-- flow-root keeps the chart's trailing margins inside .embed, which a case study's frame measures to size itself. -->
<div class="embed" class:p-6={!inline} class:pb-0={!inline} class:flow-root={inline}>
  {#if component && (chartContext.view.status === 'ready' || ($page.params.embed === 'impact-geo' && chartContext.view.status === 'failure') || $page.params.embed === EMBED_UID)}
    <svelte:component this={component} {...componentParams} />
  {:else if !($page.params.embed === 'impact-geo' && chartContext.view.status === 'empty' && chartContext.view.selection)}
    <p role="alert">The chart URL is incomplete.</p>
  {/if}
  {#if !inline}
    <div class="flex justify-between text-sm text-contour-weak border-t border-contour-weak pt-3 pb-4">
      <Logo size="sm" color="petrol-800" />
      {#if url}
        <div>
          Visit <a class="text-theme-base" href={url.url}>{url.host}</a> for more information
        </div>
      {/if}
    </div>
  {/if}
</div>
