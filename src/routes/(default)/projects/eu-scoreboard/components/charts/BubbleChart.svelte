<script>
  import { LayerCake, Svg } from 'layercake';
  import { paddedDomain, radiusForArea } from './adapter.js';
  import { formatValue } from '$lib/utils/formatting';
  import AxisX from '$lib/components/charts/axes/AxisX.svelte';
  import AxisY from '$lib/components/charts/axes/AxisY.svelte';
  import BubbleLayer from '$lib/components/charts/layers/BubbleLayer.svelte';
  import ChartFigure from './ChartFigure.svelte';
  import renderTemplate from '$utils/renderTemplate';
  import popoverTemplate from './popover-bubble.html?raw';
  import scatterPopoverTemplate from './popover-scatter.html?raw';

  export let points = [];
  export let levels = [];
  export let sizeLabel = undefined;
  export let xLabel = undefined;
  export let yLabel = undefined;
  export let xUnit = undefined;
  export let yUnit = undefined;
  export let sizeUnit = undefined;
  export let xDomain = undefined;
  export let formatX = (d) => formatValue(d, xUnit);
  export let formatY = (d) => formatValue(d, yUnit);
  export let formatSize = (d) => formatValue(d, sizeUnit);
  export let height = 'h-[460px]';
  export let tooltipLabels = {};
  export let pointMode = 'bubble';

  const padding = { top: 10, right: 96, bottom: 34, left: 62 };

  $: colorFor = (risk) => levels.find(({ uid }) => uid === risk)?.color;
  $: drawablePoints = points.filter(({ x, y, size }) => Number.isFinite(x) && Number.isFinite(y) && (pointMode === 'scatter' || Number.isFinite(size)));
  $: maximumSize = Math.max(0, ...drawablePoints.map(({ size }) => size));
  $: data = drawablePoints.map((point) => ({
    ...point,
    color: point.color ?? colorFor(point.risk),
    r: pointMode === 'scatter' ? 6 : radiusForArea(point.size, maximumSize),
    popoverContent: renderTemplate(pointMode === 'scatter' ? scatterPopoverTemplate : popoverTemplate, {
      label: point.label,
      xLabel: tooltipLabels.x ?? xLabel ?? '',
      yLabel: tooltipLabels.y ?? yLabel ?? '',
      sizeLabel: tooltipLabels.size ?? sizeLabel ?? '',
      formattedX: formatX(point.x),
      formattedY: formatY(point.y),
      formattedSize: formatSize(point.size),
    }),
  }));

  $: resolvedXDomain = xDomain ?? paddedDomain(drawablePoints.map(({ x }) => x));
  $: yDomain = paddedDomain(drawablePoints.map(({ y }) => y));

  $: legend = [...levels, ...(sizeLabel ? [{ uid: 'size', label: sizeLabel, variant: 'note' }] : [])];
</script>

<ChartFigure {legend} {xLabel} {yLabel} {height} {...$$restProps}>
  <div class="h-full w-full animate-defer-visibility">
    <LayerCake {padding} x="x" y="y" {data} xDomain={resolvedXDomain} {yDomain}>
      <Svg>
        <AxisX ticks={5} formatTick={formatX} snapTicks={true} />
        <AxisY ticks={8} formatTick={formatY} ticksHighlighted={[]} labelX={14} />
        <BubbleLayer />
      </Svg>
    </LayerCake>
  </div>
</ChartFigure>
