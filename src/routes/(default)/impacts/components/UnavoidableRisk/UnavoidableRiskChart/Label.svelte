<script>
  import { formatPercentPoints } from '$lib/utils/formatting';
  export let fullHeight;
  export let hasNoRange;
  export let differentYears;
  export let displayRange = true;
  export let latest;
  export let label;
  export let text;
  export let alignment;
  export let y;
  export let left = 0;
  export let height = 0;
</script>

<div
  class={`absolute flex ${alignment} min-h-fit`}
  style={`top: ${y}px; height: ${fullHeight}px; left: ${hasNoRange ? 10 : left}px;`}
>
  <div class="tick-label pl-2 leading-tight flex flex-col" bind:clientHeight={height}>
      {#if latest}
        <span class="text-xs {text} leading-none pb-1">
          {#if displayRange && !hasNoRange}Between {formatPercentPoints(latest.range[0])} and
          {/if}{formatPercentPoints(latest.range[1])} in <span class:font-bold={differentYears}>{latest.year}</span>
        </span>
      {/if}
    <span
      class="text-sm text-contour-weak leading-[1.1]"
      class:text-contour-weaker={!hasNoRange}>{label}</span
    >

  </div>
</div>
