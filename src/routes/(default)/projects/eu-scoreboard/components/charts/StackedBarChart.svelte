<script>
  import { LayerCake, Svg } from 'layercake';
  import { scaleBand } from 'd3-scale';
  import { ticks as tickValuesFor } from 'd3-array';
  import { findDecimalsForDistinctValues, formatValue } from '$lib/utils/formatting';
  import AxisX from '$lib/components/charts/axes/AxisX.svelte';
  import AxisY from '$lib/components/charts/axes/AxisY.svelte';
  import StackedBarLayer from '$lib/components/charts/layers/StackedBarLayer.svelte';
  import ChartFigure from './ChartFigure.svelte';
  import renderTemplate from '$utils/renderTemplate';
  import popoverTemplate from './popover-bar.html?raw';

  export let rows = [];
  export let layers = [];
  export let xLabel = undefined;
  export let unit = 'float';
  export let height = 'h-[420px]';
  export let unitLabel = xLabel;

  // Row names are drawn leftwards from the plot's edge, so the left gutter has to
  // be wide enough for the longest one or it runs off the container. Measured by
  // character count — close enough for a label gutter, and it costs no layout
  // pass. Floored so a chart of short names keeps a sane axis, and capped so one
  // very long name cannot squeeze the bars out.
  const LABEL_GAP = 14;
  const CHAR_WIDTH = 6.8;
  const MIN_GUTTER = 72;
  const MAX_GUTTER = 220;

  $: max = Math.max(0, ...rows.map(({ total = 0 }) => total));
  $: xDomain = [0, Math.max(0.5, Math.ceil(max * 2) / 2)];
  $: yDomain = rows.map(({ label }) => label);

  $: longestLabel = Math.max(0, ...yDomain.map((label) => String(label ?? '').length));
  $: gutter = Math.min(MAX_GUTTER, Math.max(MIN_GUTTER, Math.ceil(longestLabel * CHAR_WIDTH) + LABEL_GAP + 6));
  $: padding = { top: 4, right: 16, bottom: 28, left: gutter };

  // The ticks are chosen here rather than left to the axis, so the labels can be
  // formatted to the step actually used. An unrecognised unit (any natural
  // language one, e.g. °C) formats as an integer by default, which would print a
  // half-step axis as 0, 0, 1, 1 — so the step decides the decimals.
  $: xTicks = tickValuesFor(xDomain[0], xDomain[1], 10);
  $: tickStep = xTicks.length > 1 ? xTicks[1] - xTicks[0] : 1;
  $: tickDecimals = tickStep >= 1 ? 0 : tickStep >= 0.1 ? 1 : 2;

  // Bare numbers on the axis: the caption under it already names the unit, and
  // a natural-language unit would otherwise be suffixed onto every tick.
  $: formatTick = (d) => formatValue(d, unit, { addSuffix: false, decimals: tickDecimals });

  $: decimals = findDecimalsForDistinctValues(
    rows.flatMap(({ values = [] }) => values.map(({ end }) => end)),
    unit,
    0,
    2
  );

  $: tooltipRows = rows.map((row) => ({
    ...row,
    values: (row.values ?? []).map((segment) => ({
      ...segment,
      popoverContent: renderTemplate(popoverTemplate, {
        label: row.label,
        // Same again in the tooltip, which prints `unitLabel` beside the value.
        formattedValue: formatValue(segment.value, unit, { decimals, addSuffix: false }),
        unitLabel: unitLabel ?? '',
        scenario: segment.scenario ?? segment.name,
      }),
    })),
  }));
</script>

<ChartFigure legend={layers} {xLabel} {height} {...$$restProps}>
  <div class="h-full w-full animate-defer-visibility">
    <LayerCake {padding} x="total" y="label" data={tooltipRows} {xDomain} {yDomain} yScale={scaleBand().paddingInner(0.32).paddingOuter(0.1)}>
      <Svg>
        <AxisX ticks={xTicks} {formatTick} snapTicks={true} />
        <!-- Row names are the chart's reading order, so they are set in the
             theme's darkest blue and bolder than the value ticks beside them. -->
        <AxisY showTickLines={false} labelX={LABEL_GAP} tickClass="fill-theme-stronger text-xs font-bold" />
        <StackedBarLayer />
      </Svg>
    </LayerCake>
  </div>
</ChartFigure>
