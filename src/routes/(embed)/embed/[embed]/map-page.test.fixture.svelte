<script>
  import ThemeProvider from '$styles/ThemeProvider.svelte';
  import Page from './+page.svelte';

  export let data;
</script>

<ThemeProvider>
  <Page {data} />
</ThemeProvider>
