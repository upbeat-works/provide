<script>
  import AsyncContent from './AsyncContent.svelte';
  export let promise;
</script>

<AsyncContent {promise} let:value>
  <p>{value.label}</p>
</AsyncContent>
