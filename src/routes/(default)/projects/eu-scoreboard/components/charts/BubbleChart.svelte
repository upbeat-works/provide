<script>
  import { LayerCake, Svg } from 'layercake';
  import { scaleSqrt } from 'd3-scale';
  import { extent } from 'd3-array';
  import { formatValue } from '$lib/utils/formatting';
  import AxisX from '$lib/components/charts/axes/AxisX.svelte';
  import AxisY from '$lib/components/charts/axes/AxisY.svelte';
  import BubbleLayer from '$lib/components/charts/layers/BubbleLayer.svelte';
  import QuadrantLayer from '$lib/components/charts/layers/QuadrantLayer.svelte';
  import ChartFigure from './ChartFigure.svelte';
  import renderTemplate from '$utils/renderTemplate';
  import popoverTemplate from './popover-bubble.html?raw';

  // SC-01, with the trade-off's two reference lines drawn as quadrants: two
  // indicators against each other, a third as the point's size, and a class as
  // its fill.
  export let points = [];
  // `{ uid, label, color }`, matched to each point's `risk`.
  export let levels = [];
  // `{ x, y }` in data space — where the quadrants are cut.
  export let reference = {};
  export let quadrantLabels = {};
  export let sizeLabel = undefined;
  export let xLabel = undefined;
  export let yLabel = undefined;
  export let xDomain = undefined;
  export let formatX = (d) => formatValue(d);
  export let formatY = (d) => formatValue(d);
  export let formatSize = (d) => formatValue(d);
  export let height = 'h-[460px]';
  // Short names for the tooltip's three rows. The axis labels say the same
  // things, but at a length that only reads under an axis.
  export let tooltipLabels = {};

  // Right padding leaves room for the names, which sit outside their points.
  const padding = { top: 10, right: 96, bottom: 34, left: 62 };

  $: colorFor = (risk) => levels.find(({ uid }) => uid === risk)?.color;

  // Area, not radius, carries the size — a radius scale exaggerates the big
  // countries by the square of their population.
  $: sizeScale = scaleSqrt()
    .domain([0, Math.max(0, ...points.map(({ size = 0 }) => size))])
    .range([0, 30]);

  $: data = points.map((point) => ({
    ...point,
    color: colorFor(point.risk),
    r: 5 + sizeScale(point.size ?? 0),
    popoverContent: renderTemplate(popoverTemplate, {
      label: point.label,
      xLabel: tooltipLabels.x ?? xLabel ?? '',
      yLabel: tooltipLabels.y ?? yLabel ?? '',
      sizeLabel: tooltipLabels.size ?? sizeLabel ?? '',
      formattedX: formatX(point.x),
      formattedY: formatY(point.y),
      formattedSize: formatSize(point.size),
    }),
  }));

  // A domain sized to the points alone clips the biggest bubbles in half at the
  // edges, so it is padded by a share of the spread — more at the top, where the
  // quadrant labels sit and the highest point would otherwise land on them.
  $: yExtent = extent(points, ({ y }) => y);
  $: yDomain = [yExtent[0] - (yExtent[1] - yExtent[0]) * 0.12, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.22];

  $: legend = [...levels, ...(sizeLabel ? [{ uid: 'size', label: sizeLabel, variant: 'note' }] : [])];
</script>

<ChartFigure {legend} {xLabel} {yLabel} {height} {...$$restProps}>
  <div class="h-full w-full animate-defer-visibility">
    <LayerCake {padding} x="x" y="y" {data} {xDomain} {yDomain}>
      <Svg>
        <AxisX ticks={5} formatTick={formatX} snapTicks={true} />
        <AxisY ticks={8} formatTick={formatY} ticksHighlighted={[]} labelX={14} />
        <QuadrantLayer x={reference.x} y={reference.y} labels={quadrantLabels} />
        <BubbleLayer />
      </Svg>
    </LayerCake>
  </div>
</ChartFigure>
