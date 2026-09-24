<script>
  import { setContext } from 'svelte';
  import { readable } from 'svelte/store';
  import Header from './Header.svelte';

  export let url = new URL('http://localhost/impacts/eu-scoreboard');
  setContext('__svelte__', {
    page: readable({ url, data: {} }),
    navigating: readable(null),
    updated: readable(false),
  });
</script>

<Header />
