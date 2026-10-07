<script>
  import RiskLegend from './RiskLegend.svelte';
  import LayerInfoModal from './LayerInfoModal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Info from '$lib/components/icons/Info.svelte';
  import { layerInfo } from './layer-info.js';

  // The indicators view's map card: what is mapped, and the ramp it is drawn
  // with. No ranking here — that belongs to the scoreboard view's panel.
  // The heading names the whole selection (geography · scenario · year) so that
  // side-by-side maps say what makes them different; `accent` marks the part
  // being compared.
  export let parts = [];
  export let subtitle;
  export let scale;
  export let labels;
  export let ticks = [];
  // What the info button opens: the layer as configured, and what ixmp4 said
  // about the rows behind it.
  export let definition = undefined;
  export let metadata = null;
  export let grid = null;

  let isOpen = false;

  $: info = layerInfo({ definition, metadata, grid });
  // Nothing derived means nothing to open, so the button is not offered rather
  // than opening an empty panel.
  $: hasInfo = info.rows.length > 0;
</script>

<div class="flex w-[19rem] max-w-full flex-col gap-3 rounded bg-white px-5 py-4 shadow-lg">
  <div class="flex items-start gap-2">
    <h2 class="flex-1 text-sm font-semibold leading-tight text-theme-stronger">
      {#each parts as { label, accent }, i}
        {#if i > 0}<span class="mx-1 text-text-weaker">·</span>{/if}<span class:text-theme-base={accent}>{label}</span>
      {/each}
    </h2>
    {#if hasInfo}
      <!-- Icon-only, so the size's text padding is overridden down to the
           glyph; `!` because Tailwind resolves the clash by stylesheet order,
           not by the order of the class attribute. -->
      <Button variant="ghost" size="sm" class="-mr-1 -mt-0.5 shrink-0 !px-1 !py-1" on:click={() => (isOpen = true)} aria-label="About this layer">
        <Info description="About this layer" class="text-theme-base hover:text-theme-stronger" />
      </Button>
    {/if}
  </div>
  <div class="flex flex-col gap-1.5">
    <p class="text-sm font-semibold text-theme-stronger">{subtitle}</p>
    <RiskLegend {scale} {labels} {ticks} />
  </div>
</div>

{#if hasInfo}
  <LayerInfoModal bind:isOpen title={definition?.name} {parts} rows={info.rows} />
{/if}
