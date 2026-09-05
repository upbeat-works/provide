<script>
  import { getContext } from 'svelte';
  import { scaleBand } from 'd3-scale';
  import { formatRecordValue } from './model';

  export let groups;
  export let xField;
  export let yField;
  export let fields;

  const { xScale, yScale } = getContext('LayerCake');

  $: groupScale = scaleBand()
    .domain(groups.map(({ key }) => key))
    .range([0, $xScale.bandwidth()])
    .padding(0.1);
  $: valueField = fields.get(yField);
  $: bars = groups.flatMap((group) =>
    group.records.map((record) => {
      const value = Number(record[yField]);
      const category = record[xField];
      const zero = $yScale(0);
      const position = $yScale(value);
      const groupLabel = group.label ? `, ${group.label}` : '';
      return {
        x: $xScale(category) + groupScale(group.key),
        y: Math.min(zero, position),
        width: groupScale.bandwidth(),
        height: Math.abs(zero - position),
        color: group.color,
        label: `${category}${groupLabel}: ${formatRecordValue(record, valueField)}`,
      };
    }),
  );
</script>

{#each bars as bar}
  <rect
    x={bar.x}
    y={bar.y}
    width={bar.width}
    height={bar.height}
    fill={bar.color}
    tabindex="0"
    aria-label={bar.label}
  />
{/each}
