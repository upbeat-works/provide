<script>
  // Year scrubber under the map. Static placeholder: the years are generated
  // locally and selection is local state, no data behind it yet.
  // #0072BC is the scoreboard's active-state blue — a literal, not a design
  // token; it doesn't exist in color-tokens-light.json yet.
  export let years = Array.from({ length: 16 }, (_, i) => 2010 + i);
  export let selected = years[years.length - 2];
</script>

<div class="flex w-full items-stretch">
  <button type="button" aria-label="Play through years" class="shrink-0 px-4 bg-[#0072BC] text-white"> ▶ </button>
  <div class="flex flex-1 overflow-x-auto scrollbar-hide divide-x divide-contour-weakest">
    {#each years as year}
      <button
        type="button"
        aria-pressed={year === selected}
        class="flex-1 min-w-[64px] py-2 text-sm transition-colors {year === selected ? 'bg-[#0072BC] text-white font-semibold' : 'text-text-weaker hover:bg-surface-weaker'}"
        on:click={() => (selected = year)}
      >
        {year}
      </button>
    {/each}
  </div>
</div>
