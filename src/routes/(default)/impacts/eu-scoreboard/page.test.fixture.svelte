<script>
  import { setContext } from 'svelte';
  import { readable, writable } from 'svelte/store';
  import ThemeProvider from '$styles/ThemeProvider.svelte';
  import Page from './+page.svelte';
  import ViewTabs from './components/ViewTabs.svelte';
  export let data;
  export let url = new URL(
    `http://localhost/impacts/eu-scoreboard?${new URLSearchParams({ sector: data.scoreboard.sector.uid, ...Object.fromEntries(Object.entries(data.selection).map(([key, value]) => [key, value.uid])) })}`
  );
  const page = writable({ url, data });
  $: page.set({ url, data });
  setContext('__svelte__', {
    page,
    navigating: readable(null),
    updated: readable(false),
  });
</script>

<ThemeProvider>
  <ViewTabs
    items={[
      { href: '/impacts/eu-scoreboard', label: 'Ranking' },
      { href: '/impacts/eu-scoreboard/indicators', label: 'Indicators' },
    ]}
  />
  <Page {data} />
</ThemeProvider>
