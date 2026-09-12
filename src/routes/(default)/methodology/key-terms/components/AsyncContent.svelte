<script>
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  export let promise;
</script>

{#await promise}
  <LoadingPlaceholder />
{:then value}
  <slot {value} />
{:catch}
  <div class="py-16 text-center text-sm text-text-weaker" role="alert">Content could not be loaded. Try again in a moment.</div>
{/await}
