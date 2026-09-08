<script>
  import { getContext } from 'svelte';
  import tooltip from '$lib/utils/tooltip';

  // Horizontal stacked bars: one band per row, one rect per segment. Segments
  // arrive already stacked — `{ start, end, color }` in value space — so the
  // layer only scales them, and the stacking itself stays a pure function the
  // caller can test (see `stackCumulative`). A segment's `popoverContent` is its
  // tooltip.
  const { data, xScale, yGet, yScale } = getContext('LayerCake');

  export let valuesKey = 'values';
  // Hairline of background between segments, so a stack reads as parts rather
  // than as one bar with colour changes.
  export let gap = 1.5;

  $: bandwidth = typeof $yScale.bandwidth === 'function' ? $yScale.bandwidth() : 0;

  $: bars = $data.flatMap((row) =>
    (row[valuesKey] ?? []).map((segment) => {
      const x = $xScale(segment.start);
      const width = Math.max(0, $xScale(segment.end) - x - gap);
      return { ...segment, x, width, y: $yGet(row), label: row.label };
    })
  );
</script>

{#each bars as { x, y, width, color, popoverContent }}
  <rect {x} {y} {width} height={bandwidth} fill={color} use:tooltip={{ content: popoverContent, allowHTML: true }} />
{/each}
