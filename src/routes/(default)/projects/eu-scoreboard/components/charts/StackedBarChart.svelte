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

  export let rows = [];
  export let layers = [];
  export let xLabel = undefined;
  export let unit = 'float';
  export let height = 'h-[420px]';
  export let unitLabel = xLabel;

  const padding = { top: 4, right: 16, bottom: 28, left: 116 };

  $: max = Math.max(0, ...rows.map(({ total = 0 }) => total));
  $: xDomain = [0, Math.max(0.5, Math.ceil(max * 2) / 2)];
  $: yDomain = rows.map(({ label }) => label);

  $: formatTick = (d) => formatValue(d, unit);

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
        formattedValue: formatValue(segment.value, unit, { decimals }),
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
        <AxisX ticks={5} {formatTick} snapTicks={true} />
        <AxisY showTickLines={false} labelX={14} />
        <StackedBarLayer />
      </Svg>
    </LayerCake>
  </div>
</ChartFigure>
