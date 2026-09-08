<script>
  import { getContext } from 'svelte';

  // Reference lines at one x and one y value, with a name for each of the four
  // quadrants they cut the plot into — what turns a scatter into a "which of
  // these four situations is this country in?" read.
  const { width, height, xScale, yScale } = getContext('LayerCake');

  export let x = undefined;
  export let y = undefined;
  // Any of `topLeft` / `topRight` / `bottomLeft` / `bottomRight`; the ones left
  // out simply aren't drawn.
  export let labels = {};
  export let inset = 10;

  $: xPos = Number.isFinite(x) ? $xScale(x) : undefined;
  $: yPos = Number.isFinite(y) ? $yScale(y) : undefined;

  $: corners = [
    { label: labels.topLeft, x: inset, y: inset, anchor: 'start' },
    { label: labels.topRight, x: $width - inset, y: inset, anchor: 'end' },
    { label: labels.bottomLeft, x: inset, y: $height - inset, anchor: 'start' },
    { label: labels.bottomRight, x: $width - inset, y: $height - inset, anchor: 'end' },
  ].filter(({ label }) => label);
</script>

<!-- A longer dash than the axis grid's, and the theme colour rather than the
     grid's grey: these two lines are a statement about the data, not scaffolding. -->
{#if xPos !== undefined}
  <line class="stroke-theme-300" style:stroke-dasharray="5 4" x1={xPos} x2={xPos} y1="0" y2={$height} />
{/if}
{#if yPos !== undefined}
  <line class="stroke-theme-300" style:stroke-dasharray="5 4" x1="0" x2={$width} y1={yPos} y2={yPos} />
{/if}

{#each corners as { label, x: cx, y: cy, anchor }}
  <text x={cx} y={cy} class="fill-theme-weaker text-xs" text-anchor={anchor} dominant-baseline={cy < $height / 2 ? 'hanging' : 'auto'}>{label}</text>
{/each}
