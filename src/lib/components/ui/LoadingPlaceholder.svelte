<script>
  import Spinner from '$lib/components/ui/Spinner.svelte';

  export let label = 'Loading data';
</script>

<div class="flex items-center justify-center gap-3 py-16" role="status" aria-live="polite">
  <Spinner />
  <span class="text-sm text-text-weaker">{label}</span>
</div>
