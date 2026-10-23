<script>
  import { getContext } from 'svelte';
  import tooltip from '$lib/utils/tooltip';

  // Horizontal box plots: one band per row. A row carries its values —
  // `{ median, boxLow, boxHigh }`, and `whiskerLow`/`whiskerHigh` when it has
  // whiskers — so the layer only scales them. A row's `popoverContent` is its
  // tooltip, shown over the whole box and whiskers.
  const { data, xScale, yGet, yScale } = getContext('LayerCake');

  export let fill;
  export let stroke;

  $: bandwidth = typeof $yScale.bandwidth === 'function' ? $yScale.bandwidth() : 0;

  $: boxes = $data.map((row) => {
    const top = $yGet(row);
    const whiskers = Number.isFinite(row.whiskerLow) && Number.isFinite(row.whiskerHigh);
    return {
      uid: row.uid,
      popoverContent: row.popoverContent,
      top,
      middle: top + bandwidth / 2,
      left: $xScale(row.boxLow),
      right: $xScale(row.boxHigh),
      median: $xScale(row.median),
      whiskers: whiskers ? [$xScale(row.whiskerLow), $xScale(row.whiskerHigh)] : undefined,
    };
  });
</script>

{#each boxes as { uid, popoverContent, top, middle, left, right, median, whiskers } (uid)}
  <g use:tooltip={{ content: popoverContent, allowHTML: true }}>
    {#if whiskers}
      <line x1={whiskers[0]} x2={left} y1={middle} y2={middle} {stroke} stroke-width="1.5" />
      <line x1={right} x2={whiskers[1]} y1={middle} y2={middle} {stroke} stroke-width="1.5" />
      {#each whiskers as x}
        <line x1={x} x2={x} y1={top + bandwidth / 4} y2={top + (bandwidth * 3) / 4} {stroke} stroke-width="1.5" />
      {/each}
    {/if}
    <rect x={left} y={top} width={Math.max(0, right - left)} height={bandwidth} {fill} {stroke} stroke-width="1" />
    <line x1={median} x2={median} y1={top} y2={top + bandwidth} {stroke} stroke-width="3" />
  </g>
{/each}
