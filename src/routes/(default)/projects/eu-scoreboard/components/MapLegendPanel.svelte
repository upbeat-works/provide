<script>
  import RiskLegend from './RiskLegend.svelte';

  // The indicators view's map card: what is mapped, and the ramp it is drawn
  // with. No ranking here — that belongs to the scoreboard view's panel.
  // The heading names the whole selection (geography · scenario · year) so that
  // side-by-side maps say what makes them different; `accent` marks the part
  // being compared.
  export let parts = [];
  export let subtitle;
  export let scale;
  export let labels;
</script>

<div class="flex w-[19rem] max-w-full flex-col gap-3 rounded bg-white px-5 py-4 shadow-lg">
  <h2 class="text-lg leading-tight text-theme-base">
    {#each parts as { label, accent }, i}
      {#if i > 0}<span class="mx-1 text-text-weaker">·</span>{/if}<span class:font-semibold={accent} class:text-theme-stronger={accent}>{label}</span>
    {/each}
  </h2>
  <div class="flex flex-col gap-1.5">
    <p class="text-sm font-semibold">{subtitle}</p>
    <RiskLegend {scale} {labels} />
  </div>
</div>
