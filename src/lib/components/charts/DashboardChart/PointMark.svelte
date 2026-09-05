<script>
  import { getContext } from 'svelte';
  import { formatRecordValue } from './model';

  export let groups;
  export let labels;
  export let xField;
  export let yField;
  export let fields;

  const { xGet, yGet } = getContext('LayerCake');
  let active;

  $: xFieldSchema = fields.get(xField);
  $: yFieldSchema = fields.get(yField);
  $: points = groups.flatMap((group) =>
    group.records.map((record) => {
      const name = labels.map((field) => record[field]).join(' · ');
      return {
        x: $xGet(record),
        y: $yGet(record),
        color: group.color,
        label: `${name} — ${xFieldSchema.label}: ${formatRecordValue(record, xFieldSchema)}, ${yFieldSchema.label}: ${formatRecordValue(record, yFieldSchema)}`,
      };
    }),
  );
</script>

{#each points as point}
  <circle
    cx={point.x}
    cy={point.y}
    r="5"
    fill={point.color}
    stroke="white"
    stroke-width="2"
    tabindex="0"
    aria-label={point.label}
    on:mouseenter={() => (active = point)}
    on:mouseleave={() => (active = undefined)}
    on:focus={() => (active = point)}
    on:blur={() => (active = undefined)}
  />
{/each}

{#if active}
  <g role="tooltip" transform={`translate(${active.x + 8}, ${active.y - 24})`}>
    <rect width="340" height="22" rx="2" fill="white" stroke="currentColor" stroke-opacity="0.2" />
    <text x="6" y="15" class="fill-contour-base text-xs">{active.label}</text>
  </g>
{/if}
