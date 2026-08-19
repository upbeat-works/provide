<script>
  import { getContext } from 'svelte';
  import { area } from 'd3-shape';

  let chartData;
  export { chartData as data };
  export let y0Key = 'min';
  export let y1Key = 'max';
  export let color;

  const { data, xGet, yScale } = getContext('LayerCake');

  $: chartData = chartData || $data;

  // A scenario shorter than the chart's year axis (e.g. a base scenario that
  // stops at 2100 while others run to 2300) is NaN-padded for the years it
  // lacks, not trimmed — see zipBands/alignBands. Without `.defined()`, d3
  // embeds that NaN in the path's `d` string, which is invalid SVG: browsers
  // render only up to the first bad coordinate and silently drop everything
  // after it, not just the gap. `.defined()` makes d3 break the shape into
  // separate sub-paths around the gap instead.
  $: areaGen = area()
    .defined((d) => Number.isFinite(d[y0Key]) && Number.isFinite(d[y1Key]))
    .x((d) => $xGet(d))
    .y0((d) => $yScale(d[y0Key]))
    .y1((d) => $yScale(d[y1Key]));
</script>

<path class="path-area opacity-20" d={areaGen(chartData)} fill={color} />
