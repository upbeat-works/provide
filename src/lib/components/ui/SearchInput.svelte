<script>
  import Magnify from '$lib/components/icons/Magnify.svelte';

  export let value = '';
  export let placeholder = 'Search';
</script>

<div class="relative {$$props.class ?? ''}">
  <Magnify class="absolute left-3 top-1/2 -translate-y-1/2 text-text-weaker w-4 h-4 pointer-events-none" />
  <input
    type="search"
    bind:value
    {placeholder}
    class="w-full pl-9 pr-3 py-3 font-sans text-sm text-text-base border border-contour-weakest rounded-sm bg-white placeholder:text-text-weaker focus:outline-none focus:ring-1 focus:ring-theme-base"
  />
</div>
