<script>
  // Shared by the explore maps and the eu-scoreboard indicators map. While the
  // map is inert a wheel over it scrolls the page instead of zooming; this
  // overlay is the way back in. It covers the map and so intercepts the first
  // click, which is why a map whose primary action is a click (the scoreboard's
  // country picker) does not render it.
  //
  // Stacking is by DOM order — it must come after the map element. ("z-1" used
  // to sit here, but Tailwind's scale has no such step, so it never applied.)
  export let interactive;
</script>

{#if !interactive}
  <div
    class="absolute inset-0 flex items-center justify-center transition-all duration-100 hover:opacity-100 opacity-0"
  >
    <button
      on:click={() => (interactive = true)}
      class="text-surface-base px-6 py-3 bg-black/60 rounded-full"
    >
      Click to make map interactive
    </button>
  </div>
  <!-- {:else}
  <button
    on:click={() => (interactive = false)}
    class="absolute top-0 right-0 text-surface-base px-3 py-1 bg-black/60 rounded-full"
  >
    Static
  </button> -->
{/if}
