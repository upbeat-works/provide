<script>
  import { getContext } from 'svelte';
  import tooltip from '$lib/utils/tooltip';

  // Point markers on the same series MultipleLineLayer draws, so a line that
  // only carries a handful of samples shows where they actually are rather than
  // implying values between them.
  //
  // A value carrying `popoverContent` gets that as its tooltip, hung off an
  // invisible target wider than the dot — the marker is too small to hit
  // reliably, which is why ImpactTime's TriggerPoints does the same.
  const { data, xGet, yGet } = getContext('LayerCake');

  export let r = 5;
  export let valuesKey = 'values';
  export let hitRadius = 12;

  $: dots = $data.flatMap((series) =>
    (series[valuesKey] ?? []).filter((d) => Number.isFinite($yGet(d))).map((d) => ({ x: $xGet(d), y: $yGet(d), color: series.color, uid: series.uid, popoverContent: d.popoverContent }))
  );
</script>

{#each dots as { x, y, color, popoverContent }}
  <g transform={`translate(${x}, ${y})`}>
    <circle {r} fill={color} class="stroke-2 stroke-surface-base" />
    {#if popoverContent}
      <circle r={hitRadius} class="fill-transparent" use:tooltip={{ content: popoverContent, allowHTML: true }} />
    {/if}
  </g>
{/each}
