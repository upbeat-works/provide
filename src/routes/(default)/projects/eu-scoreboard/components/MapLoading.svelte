<script>
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';

  // The map band's one loading state. The band waits on two things — the
  // bundled boundaries it draws with, and the values it colours them by — and
  // they arrive independently, so the reader would otherwise see two different
  // placeholders for what is, to them, the same map still loading.
  //
  // Sized to the band it stands in, so the page does not jump when the map
  // lands. `h-full` where the caller already sized the space.
  export let height = 'h-full';
</script>

<div class="flex {height} w-full items-center justify-center">
  <LoadingPlaceholder label="Loading map" />
</div>
