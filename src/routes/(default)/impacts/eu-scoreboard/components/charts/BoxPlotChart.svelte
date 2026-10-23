<script>
  import { LayerCake, Svg } from 'layercake';
  import { scaleBand } from 'd3-scale';
  import { findDecimalsForDistinctValues, formatCompact, formatValue } from '$lib/utils/formatting';
  import AxisX from '$lib/components/charts/axes/AxisX.svelte';
  import AxisY from '$lib/components/charts/axes/AxisY.svelte';
  import BoxPlotLayer from '$lib/components/charts/layers/BoxPlotLayer.svelte';
  import ChartFigure from './ChartFigure.svelte';
  import renderTemplate from '$utils/renderTemplate';
  import popoverTemplate from './popover-box.html?raw';
  import rangeRowTemplate from './popover-series-range.html?raw';

  export let rows = [];
  export let legend = [];
  export let labels = {};
  export let xLabel = undefined;
  export let xDomain = undefined;
  export let unit = undefined;
  export let fill;
  export let stroke;
  export let height = 'h-[420px]';
  // Accepted from the adapter but intentionally unrendered: the year is already
  // stated by the panel's filters, so a pill on the chart just repeats it.
  export let selectedYear = undefined;

  // Row names are drawn leftwards from the plot's edge, so the gutter is sized
  // to the longest one — the same measure the stacked bars use.
  const LABEL_GAP = 14;
  const CHAR_WIDTH = 6.8;
  const MIN_GUTTER = 72;
  const MAX_GUTTER = 220;

  $: yDomain = rows.map(({ label }) => label);
  $: longestLabel = Math.max(0, ...yDomain.map((label) => String(label ?? '').length));
  $: gutter = Math.min(MAX_GUTTER, Math.max(MIN_GUTTER, Math.ceil(longestLabel * CHAR_WIDTH) + LABEL_GAP + 6));
  $: padding = { top: 4, right: 16, bottom: 28, left: gutter };

  $: decimals = findDecimalsForDistinctValues(
    rows.flatMap((row) => Object.keys(labels).map((role) => row[role])),
    unit,
    0,
    2
  );
  $: format = (d) => formatValue(d, unit, { decimals, addSuffix: false });
  // Bare, compact numbers on the axis: the caption under it names the unit.
  $: formatTick = (d) => formatCompact(d, unit);

  const rangeRow = (row, low, high, format) =>
    Number.isFinite(row[low]) && Number.isFinite(row[high])
      ? renderTemplate(rangeRowTemplate, { rangeLabel: `${labels[low]} – ${labels[high]}`, range: `${format(row[low])} – ${format(row[high])}` })
      : '';

  $: tooltipRows = rows.map((row) => ({
    ...row,
    popoverContent: renderTemplate(popoverTemplate, {
      label: row.label,
      formattedMedian: `${format(row.median)}${unit ? ` ${unit}` : ''}`,
      medianLabel: labels.median ?? '',
      rangeRows: rangeRow(row, 'boxLow', 'boxHigh', format) + rangeRow(row, 'whiskerLow', 'whiskerHigh', format),
    }),
  }));
</script>

<ChartFigure {legend} {xLabel} {height} {...$$restProps}>
  <div class="h-full w-full animate-defer-visibility">
    <LayerCake {padding} x="median" y="label" data={tooltipRows} {xDomain} {yDomain} yScale={scaleBand().paddingInner(0.32).paddingOuter(0.1)}>
      <Svg>
        <AxisX ticks={6} {formatTick} snapTicks={true} />
        <AxisY showTickLines={false} labelX={LABEL_GAP} tickClass="fill-theme-stronger text-xs font-bold" />
        <BoxPlotLayer {fill} {stroke} />
      </Svg>
    </LayerCake>
  </div>
</ChartFigure>
