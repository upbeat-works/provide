<script>
  import { getContext } from 'svelte';

  // Zoom control for MapProvider — a slot child, so it reads the map off the
  // mapbox context like the layer components do. Mapbox's own
  // NavigationControl is a vertical 29px pair that fights its stylesheet to
  // restyle, so this draws the buttons directly.
  export let position = 'top-4 right-6';

  const { map } = getContext('mapbox');
</script>

<div class="absolute {position} z-10 flex overflow-hidden rounded border border-theme-weakest bg-surface-base divide-x divide-theme-weakest shadow-sm">
  <button type="button" aria-label="Zoom out" class="flex h-11 w-11 items-center justify-center text-theme-stronger transition-colors hover:bg-surface-weaker" on:click={() => $map?.zoomOut()}>
    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 12h14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
    </svg>
  </button>
  <button type="button" aria-label="Zoom in" class="flex h-11 w-11 items-center justify-center text-theme-stronger transition-colors hover:bg-surface-weaker" on:click={() => $map?.zoomIn()}>
    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
    </svg>
  </button>
</div>
