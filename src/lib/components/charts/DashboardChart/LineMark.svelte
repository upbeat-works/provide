<script>
  import { getContext } from 'svelte';
  import { area, line } from 'd3-shape';

  export let groups;
  export let range = undefined;
  export let valueLabel;

  const { xGet, yGet, yScale } = getContext('LayerCake');

  const isFinitePoint = (record) => Number.isFinite($xGet(record)) && Number.isFinite($yGet(record));
  $: lineGenerator = line().defined(isFinitePoint).x($xGet).y($yGet);
  $: areaGenerator = range
    ? area()
        .defined((record) => Number.isFinite($xGet(record)) && Number.isFinite(record[range.lower]) && Number.isFinite(record[range.upper]))
        .x($xGet)
        .y0((record) => $yScale(record[range.lower]))
        .y1((record) => $yScale(record[range.upper]))
    : undefined;
</script>

{#each groups as group}
  {@const label = group.label || valueLabel}
  {#if areaGenerator}
    <path
      d={areaGenerator(group.records)}
      fill={group.color}
      fill-opacity="0.16"
      aria-label={`${label} range`}
    />
  {/if}
  <path
    d={lineGenerator(group.records)}
    fill="none"
    stroke={group.color}
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    tabindex="0"
    aria-label={`${label}: ${group.records.filter(isFinitePoint).length} values`}
  />
{/each}
