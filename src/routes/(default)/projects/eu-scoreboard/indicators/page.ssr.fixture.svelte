<script>
  import { setContext } from 'svelte';
  import { readable } from 'svelte/store';
  import ThemeProvider from '$styles/ThemeProvider.svelte';
  import Page from './+page.svelte';

  export let data;
  setContext('__svelte__', {
    page: readable({ url: new URL('http://localhost/projects/eu-scoreboard/indicators'), data }),
    navigating: readable(null),
    updated: readable(false),
  });
</script>

<ThemeProvider>
  <Page {data} />
</ThemeProvider>
