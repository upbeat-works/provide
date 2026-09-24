<script>
  import ThemeProvider from '$styles/ThemeProvider.svelte';
  import ChartEmbed from '../components/charts/ChartEmbed.svelte';
  export let result;
  export let selection = {};
  export let sector;
  export let staticMode;
</script>
<ThemeProvider><ChartEmbed {result} {selection} {sector} {staticMode} /></ThemeProvider>
