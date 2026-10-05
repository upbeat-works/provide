<script>
  import ColorLegend from '$lib/components/charts/legends/ColorLegend.svelte';
  import InfoButton from '$lib/components/charts/ChartFrame/InfoButton.svelte';
  import InfoList from '$lib/components/charts/ChartFrame/InfoList.svelte';
  import DownloadGraphMenu from '$lib/components/charts/ChartFrame/DownloadGraphMenu.svelte';

  export let legend = [];
  export let yLabel = undefined;
  export let xLabel = undefined;
  export let height = 'h-[360px]';

  export let chartInfo = [];
  export let chartUid = undefined;
  export let graphDownloadParams = undefined;
  export let graphDownloadSettings = {};
  export let staticMode = false;

  $: hasCaption = chartInfo.length || graphDownloadParams;
</script>

<figure>
  {#if legend.length}
    <ColorLegend items={legend} class="mb-4 items-center gap-y-2" labelClass="font-normal text-text-weaker" />
  {/if}

  <div class="flex gap-2">
    {#if yLabel}
      <span class="self-center rotate-180 text-xs text-text-weaker [writing-mode:vertical-rl]">{yLabel}</span>
    {/if}
    <div class="min-w-0 flex-1 {height}">
      <slot />
    </div>
  </div>

  {#if xLabel}
    <p class="mt-1 text-center text-xs text-text-weaker">{xLabel}</p>
  {/if}

  {#if !staticMode && hasCaption}
    <figcaption class="flex justify-end items-center gap-4 mt-2 mb-2">
      <InfoButton label="About the data" items={chartInfo} />
      <DownloadGraphMenu embedUid={chartUid} {...graphDownloadSettings} graphParams={graphDownloadParams} />
    </figcaption>
  {:else}
    <InfoList items={chartInfo} />
  {/if}
</figure>
