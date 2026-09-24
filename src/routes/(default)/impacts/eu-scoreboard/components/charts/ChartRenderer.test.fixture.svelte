<script>
  import ThemeProvider from '$styles/ThemeProvider.svelte';
  import ChartRenderer from './ChartRenderer.svelte';
  export let result;
  export let selection = {};
</script>

<ThemeProvider><ChartRenderer {result} {selection} /></ThemeProvider>
