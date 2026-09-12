<script>
  import ColorLegend from '$lib/components/charts/legends/ColorLegend.svelte';
  import InfoButton from '$lib/components/charts/ChartFrame/InfoButton.svelte';
  import InfoList from '$lib/components/charts/ChartFrame/InfoList.svelte';
  import DataDownloadMenu from '$lib/components/charts/ChartFrame/DataDownloadMenu.svelte';
  import DownloadGraphMenu from '$lib/components/charts/ChartFrame/DownloadGraphMenu.svelte';

  // The shell every scoreboard chart sits in: the legend that names its series,
  // the axis labels (HTML rather than SVG text, so the rotated one stays
  // readable at any chart height), and the caption row.
  //
  // The section heading above already carries the title and description a
  // ChartFrame would render, so this is that frame without its header — the
  // caption is ChartFrame's own, component for component, so a scoreboard chart
  // offers the same three things an explore chart does.
  export let legend = [];
  export let yLabel = undefined;
  export let xLabel = undefined;
  export let height = 'h-[360px]';

  // Caption row. Each part is drawn only when it has something to offer, so a
  // chart can carry its info without pretending to a download it can't serve.
  export let chartInfo = [];
  // The `/embed/<uid>` the graph download screenshots.
  export let chartUid = undefined;
  export let graphDownloadParams = undefined;
  export let graphDownloadSettings = {};
  // The API endpoint the data download asks for, and the selection it asks with.
  export let dataDownloadEndpoint = undefined;
  export let dataDownloadParams = undefined;
  export let dataDownloadOptions = [];
  export let staticMode = false;

  $: hasCaption = chartInfo.length || graphDownloadParams || dataDownloadEndpoint;
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

  <!-- Static rendering is the screenshot the graph download takes: menus that
       cannot be opened in an image become the list they would have shown. -->
  {#if !staticMode && hasCaption}
    <figcaption class="flex justify-end items-center gap-4 mt-2 mb-2">
      <InfoButton label="About the data" items={chartInfo} />
      <DownloadGraphMenu embedUid={chartUid} {...graphDownloadSettings} graphParams={graphDownloadParams} />
      {#if dataDownloadEndpoint}
        <DataDownloadMenu endpoint={dataDownloadEndpoint} options={dataDownloadOptions} params={dataDownloadParams} base={import.meta.env.VITE_API_URL} arrayFormat="repeat" />
      {/if}
    </figcaption>
  {:else}
    <InfoList items={chartInfo} />
  {/if}
</figure>
