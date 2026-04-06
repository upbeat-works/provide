<script>
  export let wrapperClass = ‘’;
</script>

<div>
  <div class="px-4 pt-4 pb-3 pr-12 bg-theme-50">
    <slot name="header" />
  </div>
  <div class="grid grid-cols-1 md:grid-cols-[1fr_2fr] h-[32rem] {wrapperClass}">
    <div class="overflow-y-auto md:border-r border-contour-weakest">
      <slot name="sidebar" />
    </div>
    <div class="hidden md:overflow-y-auto md:flex">
      <slot name="content" />
    </div>
  </div>
</div>
