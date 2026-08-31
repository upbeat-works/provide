<script>
  export let wrapperClass = '';
</script>

<div class="flex flex-col min-h-0 flex-1">
  <div class="px-4 pt-4 pb-3 pr-12 bg-theme-50">
    <slot name="header" />
  </div>
  <!-- min-w-0 on the columns: grid/flex children default to min-width:auto, so
       without it a long word sets the column's width and scrolls the panel
       sideways instead of wrapping. Overflow stays vertical-only. -->
  <div class="grid grid-cols-1 md:grid-cols-[1fr_2fr] flex-1 min-h-0 {wrapperClass}">
    <div class="min-w-0 overflow-y-auto overflow-x-hidden md:border-r border-contour-weakest">
      <slot name="sidebar" />
    </div>
    <div class="hidden min-w-0 md:overflow-y-auto md:overflow-x-hidden md:flex">
      <slot name="content" />
    </div>
  </div>
</div>
