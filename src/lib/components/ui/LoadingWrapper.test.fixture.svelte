<script>
  import LoadingWrapper from './LoadingWrapper.svelte';

  export let request;
</script>

<LoadingWrapper asyncProps={{ request }} let:asyncProps>
  <p>{asyncProps.request.data.label}</p>
</LoadingWrapper>
