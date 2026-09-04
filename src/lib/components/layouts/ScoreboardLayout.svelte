<script>
  // Page shell for a scoreboard view, below the hero — the hero and the view
  // tabs belong to the route layout, shared by both views. Order here is
  // sticky control bar -> full-bleed visual (the map and whatever floats over
  // it) -> content. Content comes in two shapes: with a `sidebar` slot it is an
  // index column beside an article column, without one it is a single stacked
  // column.

  // Exposed so sticky content inside the sections can clear the control bar.
  export let barHeight = 0;
</script>

{#if $$slots.filters || $$slots.actions}
  <div bind:clientHeight={barHeight} class="sticky top-0 z-40 bg-white border-b border-contour-weakest">
    <div class="mx-auto max-w-7xl flex items-stretch">
      <div class="flex min-w-0 flex-1 overflow-x-auto scrollbar-hide divide-x divide-contour-weakest [&>*]:shrink-0 [&>*]:px-6 [&>*]:py-3">
        <slot name="filters" />
      </div>
      {#if $$slots.actions}
        <div class="shrink-0 flex items-center gap-2 px-6 py-3 border-l border-contour-weakest">
          <slot name="actions" />
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if $$slots.visual}
  <div class="relative bg-surface-weakest">
    <slot name="visual" />
  </div>
{/if}

{#if $$slots.sidebar}
  <div class="mx-auto max-w-7xl px-6 grid grid-cols-1 md:grid-cols-[minmax(0,15rem)_1fr] gap-8 md:gap-16">
    <div class="py-10 md:sticky h-fit" style="top: {barHeight}px">
      <slot name="sidebar" />
    </div>
    <div class="min-w-0">
      <slot />
    </div>
  </div>
{:else}
  <div class="mx-auto max-w-7xl px-6">
    <slot />
  </div>
{/if}
