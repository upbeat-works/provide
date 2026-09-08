<script>
  import { LayerCake, Svg } from 'layercake';
  import { scaleBand } from 'd3-scale';
  import { findDecimalsForDistinctValues, formatValue } from '$lib/utils/formatting';
  import AxisX from '$lib/components/charts/axes/AxisX.svelte';
  import AxisY from '$lib/components/charts/axes/AxisY.svelte';
  import StackedBarLayer from '$lib/components/charts/layers/StackedBarLayer.svelte';
  import ChartFigure from './ChartFigure.svelte';
  import renderTemplate from '$utils/renderTemplate';
  import popoverTemplate from './popover-bar.html?raw';

  // BR-03, stacked rather than grouped: the pathways are cumulative here, so
  // the segments of one bar are one quantity under three futures, and the bar's
  // length is the highest of them.
  export let rows = [];
  // The stack's layers, low to high — the legend, and the order the segments
  // were stacked in.
  export let layers = [];
  export let xLabel = undefined;
  export let unit = 'float';
  export let height = 'h-[420px]';
  // What a segment's number is counted in, said in the tooltip where the x-axis
  // label isn't in view.
  export let unitLabel = xLabel;

  // Long enough for the region names; the labels are the axis here, so they
  // cannot be allowed to truncate.
  const padding = { top: 4, right: 16, bottom: 28, left: 116 };

  $: max = Math.max(0, ...rows.map(({ total = 0 }) => total));
  // Round out to the next half unit so the axis ends on a tick rather than on
  // the longest bar.
  $: xDomain = [0, Math.ceil(max * 2) / 2];
  $: yDomain = rows.map(({ label }) => label);

  $: formatTick = (d) => formatValue(d, unit);

  // The axis rounds to halves; a tooltip that did the same would report 1.85 as
  // 1.9, so it takes the decimals the values actually need.
  $: decimals = findDecimalsForDistinctValues(
    rows.flatMap(({ values = [] }) => values.map(({ end }) => end)),
    unit,
    0,
    2
  );

  // Each segment carries its own tooltip. The number is the segment's top, not
  // its width: the layers are cumulative, so that is the total under that
  // pathway rather than the amount this band adds.
  $: tooltipRows = rows.map((row) => ({
    ...row,
    values: (row.values ?? []).map((segment) => ({
      ...segment,
      popoverContent: renderTemplate(popoverTemplate, {
        label: row.label,
        formattedValue: formatValue(segment.end, unit, { decimals }),
        unitLabel: unitLabel ?? '',
        scenario: segment.scenario ?? segment.name,
      }),
    })),
  }));
</script>

<ChartFigure legend={layers} {xLabel} {height} {...$$restProps}>
  <div class="h-full w-full animate-defer-visibility">
    <!-- The band domain is stated rather than collected from the rows: the rows
         arrive ranked, and a domain LayerCake derives comes back alphabetical. -->
    <LayerCake {padding} x="total" y="label" data={tooltipRows} {xDomain} {yDomain} yScale={scaleBand().paddingInner(0.32).paddingOuter(0.1)}>
      <Svg>
        <AxisX ticks={xDomain[1] * 2} {formatTick} snapTicks={true} />
        <!-- No horizontal grid: the bands are the rows, and a line through each
             of them only fights the bars. -->
        <AxisY showTickLines={false} labelX={14} />
        <StackedBarLayer />
      </Svg>
    </LayerCake>
  </div>
</ChartFigure>
