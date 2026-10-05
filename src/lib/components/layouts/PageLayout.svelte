<script>
  let navHeight = 0;
</script>

<slot name="hero" />

{#if $$slots.nav}
<!-- z-40, below the site header's z-50: this bar sticks to the top of the
     viewport on scroll, and at an equal z-index it would paint over the
     header's Tools dropdown simply by coming later in the DOM. -->
<div bind:clientHeight={navHeight} class="relative md:sticky md:top-0 z-40">
  <slot name="nav" />
</div>
{/if}

<div class="relative grid grid-rows-[auto_auto] grid-cols-1 md:grid-cols-[280px_1fr] md:grid-rows-1 mx-auto max-w-7xl">
  <div class="pl-6 py-8 flex flex-col gap-4 md:sticky h-fit" style="top: {navHeight}px">
    <slot name="sidebar" />
  </div>
  <div class="md:border-l border-contour-weakest border-t md:border-t-0 min-w-0">
    {#if $$slots.filters}
    <div>
      <div class="flex h-fit bg-white border-b border-contour-weakest [&>*]:border-r [&>*]:border-contour-weakest [&>*]:px-6 [&>*]:py-4">
        <slot name="filters" />
      </div>
    </div>
    {/if}
    <div class="px-6 py-8">
      <slot name="content" />
    </div>
  </div>
</div>
