<script>
  import { LayerCake, Svg } from 'layercake';
  import { scaleBand, scaleLinear } from 'd3-scale';
  import AxisX from '../axes/AxisX.svelte';
  import AxisY from '../axes/AxisY.svelte';
  import ColorLegend from '../legends/ColorLegend.svelte';
  import { formatValue } from '../../../utils/formatting.js';
  import LineMark from './LineMark.svelte';
  import BarMark from './BarMark.svelte';
  import PointMark from './PointMark.svelte';

  export let model;

  const padding = { top: 18, right: 18, bottom: 32, left: 58 };

  $: xField = model.fields.get(model.xAxis.field);
  $: yField = model.fields.get(model.yAxis.field);
  $: xScale = model.xAxis.scale === 'band' ? scaleBand().paddingInner(0.18).paddingOuter(0.08) : scaleLinear();
  $: yScale = scaleLinear();
  $: records = [...new Set(model.marks.flatMap(({ groups }) => groups.flatMap(({ records }) => records)))];
  $: chartLabel = `${yField.label} by ${xField.label}`;
  $: formatTickX = (value) => {
    if (model.xAxis.scale === 'band') {
      return String(value);
    }
    return formatValue(value, xField.unit, { addSuffix: false });
  };
</script>

{#if model.legend.length}
  <ColorLegend items={model.legend} class="mb-4" />
{/if}

<div role="img" aria-label={chartLabel}>
  <div class="h-80 w-full overflow-hidden">
    <LayerCake
      {padding}
      x={model.xAxis.field}
      y={model.yAxis.field}
      {xScale}
      {yScale}
      xDomain={model.xDomain}
      yDomain={model.yDomain}
      data={records}
      flatData={records}
    >
      <Svg>
        <AxisX formatTick={formatTickX} ticks={model.xAxis.scale === 'band' ? model.xDomain : 5} />
        <AxisY {padding} ticks={5} unit={yField.unit} axisLabel={yField.label} />
        {#each model.marks as mark}
          {#if mark.schema.type === 'line'}
            <LineMark groups={mark.groups} range={mark.schema.range} valueLabel={yField.label} />
          {:else if mark.schema.type === 'bar'}
            <BarMark groups={mark.groups} xField={model.xAxis.field} yField={model.yAxis.field} fields={model.fields} />
          {:else if mark.schema.type === 'point'}
            <PointMark
              groups={mark.groups}
              labels={mark.schema.labels}
              xField={model.xAxis.field}
              yField={model.yAxis.field}
              fields={model.fields}
            />
          {/if}
        {/each}
      </Svg>
    </LayerCake>
  </div>
  <p class="mt-1 text-center text-xs text-contour-weaker">{xField.label}</p>
</div>
