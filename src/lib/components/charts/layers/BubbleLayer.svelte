<script>
  import { getContext } from 'svelte';
  import { sortBy } from 'lodash-es';
  import tooltip from '$lib/utils/tooltip';

  // Points sized by a third value and named in place — Dots.svelte draws one
  // fixed radius and labels only what is highlighted, which is the wrong shape
  // for a chart where the size carries meaning and every point is identified.
  const { data, xGet, yGet } = getContext('LayerCake');

  // Radius in pixels, per datum: the size scale belongs to the chart, which is
  // the only place that knows the extent it maps from.
  export let rKey = 'r';
  export let labelKey = 'label';
  export let showLabels = true;

  // Largest first, so a small point is never buried under a big one.
  // `labelSide: 'left'` moves one name to the other side of its point, which is
  // the only way out where two points are close enough that both names would be
  // written into the same space.
  $: points = sortBy($data, (d) => -d[rKey]).map((d) => ({
    x: $xGet(d),
    y: $yGet(d),
    r: d[rKey],
    color: d.color,
    label: d[labelKey],
    labelSide: d.labelSide === 'left' ? 'left' : 'right',
    popoverContent: d.popoverContent,
  }));
</script>

{#each points as { x, y, r, color, popoverContent }}
  <circle cx={x} cy={y} {r} fill={color} class="stroke-1 stroke-surface-base" use:tooltip={{ content: popoverContent, allowHTML: true }} />
{/each}

<!-- Every label after every point, so a name is never buried under the next
     country's bubble, and haloed so it survives landing on one. They sit over
     the points, so they must not swallow the hover that belongs to them. -->
{#if showLabels}
  {#each points as { x, y, r, label, labelSide }}
    {@const isLeft = labelSide === 'left'}
    <text x={isLeft ? x - r - 6 : x + r + 6} {y} text-anchor={isLeft ? 'end' : 'start'} class="label pointer-events-none fill-contour-weak text-xs" dominant-baseline="middle">{label}</text>
  {/each}
{/if}

<style lang="postcss">
  .label {
    stroke: white;
    stroke-width: 3px;
    paint-order: stroke;
  }
</style>
