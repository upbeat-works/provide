<script>
  import Placeholder from './Placeholder.svelte';

  // A placeholder chart plus the caption row every scoreboard chart carries
  // (about / download graph / download data). The links are inert until the
  // real ChartFrame wiring exists.
  export let label;
  export let legend = [];
  export let height = 'h-72';
</script>

<figure>
  {#if legend.length}
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-sm text-text-weaker">
      {#each legend as item}
        <span class="flex items-center gap-2">
          <span class="inline-block h-2 w-6 rounded-sm bg-contour-weakest" />
          {item}
        </span>
      {/each}
    </div>
  {/if}

  <Placeholder {label} {height} />

  <figcaption class="flex justify-end items-center gap-4 mt-2 text-sm text-theme-base">
    <span>About the data</span>
    <span>Download Graph</span>
    <span>Download Data</span>
  </figcaption>
</figure>
