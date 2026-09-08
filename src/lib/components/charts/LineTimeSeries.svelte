<script>
  import { LayerCake, Svg } from 'layercake';
  import { getMarginLeft } from '$lib/utils/utils.js';
  import { DEFAULT_FORMAT_UID } from '$src/config.js';
  import MultipleLineLayer from './layers/MultipleLineLayer.svelte';
  import MultipleAreaLayer from './layers/MultipleAreaLayer.svelte';
  import SeriesDots from './layers/SeriesDots.svelte';
  import AxisX from './axes/AxisX.svelte';
  import AxisY from './axes/AxisY.svelte';
  import { extent } from 'd3-array';

  // One line per series over time, with a band around any series that carries
  // `min`/`max` — the two line contracts (plain trajectories, and a central
  // estimate inside a percentile range) are the same chart with and without the
  // band, so they are the same component.
  //
  // A series is `{ uid, label, color, dash, values: [{ year, value, min, max }] }`;
  // `dash` is an SVG stroke-dasharray for telling lines apart by shape as well
  // as by colour, and `range` overrides the band's fill.
  export let data = [];
  export let xKey = 'year';
  export let yKey = 'value';
  export let unit = DEFAULT_FORMAT_UID;
  export let yDomain = undefined;
  export let ticksYHighlighted = [0];
  export let xTicks = 4;
  export let yTicks = 4;
  export let strokeWidth = 3;
  // Markers on each sample. Worth showing when a series is a handful of decadal
  // steps rather than an annual trajectory.
  export let showDots = false;
  export let dotRadius = 5;
  // Share of the value range left clear above and below the series.
  export let yPadding = 0.06;

  $: unitUID = unit?.uid ?? unit ?? DEFAULT_FORMAT_UID;

  // Both bounds go in so the domain covers the band, not just the central line.
  // A series without a band has none, and an absent bound must not reach the
  // scales as an undefined value.
  $: flatData = data.reduce((memo, group) => {
    (group.values ?? []).forEach(({ min, value, max, year }) => {
      [min, value, max].filter(Number.isFinite).forEach((v) => memo.push({ year, value: v }));
    });
    return memo;
  }, []);

  // The band's fill defaults to the line's colour, which is what
  // MultipleAreaLayer reads.
  $: chartData = data.map((series) => ({ ...series, range: series.range ?? series.color }));

  // A domain drawn tight to the data cuts the first and last markers in half
  // against the axes, and a band that reaches its extreme is flattened along the
  // top of the plot. Breathing room, unless the caller has named a domain.
  $: valueExtent = extent(flatData, (d) => d.value);
  $: domain =
    yDomain ?? (valueExtent.every(Number.isFinite) ? [valueExtent[0] - (valueExtent[1] - valueExtent[0]) * yPadding, valueExtent[1] + (valueExtent[1] - valueExtent[0]) * yPadding] : undefined);

  // Left padding has to fit the widest tick label, the way ImpactTimeChart
  // sizes it — a fixed margin either clips "4.5" or wastes half an inch.
  $: padding = { top: 10, right: 10, bottom: 30, left: getMarginLeft(domain?.[1] ?? valueExtent[1], unitUID) };
</script>

<div class="chart-container">
  <LayerCake {padding} x={xKey} y={yKey} yDomain={domain} data={chartData} {flatData}>
    <Svg>
      <AxisX ticks={xTicks} snapTicks={true} />
      <AxisY {padding} ticks={yTicks} unit={unitUID} ticksHighlighted={ticksYHighlighted} />
      <MultipleAreaLayer />
      <MultipleLineLayer {strokeWidth} />
      {#if showDots}
        <SeriesDots r={dotRadius} />
      {/if}
    </Svg>
  </LayerCake>
</div>

<style lang="postcss">
  .chart-container {
    width: 100%;
    height: 100%;
    animation: defer-visibility 0.5s;
  }
</style>
