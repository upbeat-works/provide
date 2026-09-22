<script>
  import { setContext } from 'svelte';
  import { readable } from 'svelte/store';
  import ThemeProvider from '$styles/ThemeProvider.svelte';
  import Page from './+page.svelte';

  export let data;
  export let url = new URL('http://localhost/projects/eu-scoreboard/indicators');
  setContext('__svelte__', {
    page: readable({ url, data }),
    navigating: readable(null),
    updated: readable(false),
  });
</script>

<ThemeProvider>
  <Page {data} />
</ThemeProvider>
