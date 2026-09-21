<script>
  import ChartRenderer from './ChartRenderer.svelte';
  import { isChartVisible } from './adapter.js';

  export let result;
  export let selection = {};
  export let sector = undefined;
  export let staticMode = false;

  $: visible = result && isChartVisible(result, selection);
</script>

{#if visible}
  <header class="mb-4 max-w-prose">
    <h1 class="mb-3 text-2xl font-normal">{result.definition.title}</h1>
    <p class="leading-relaxed">{result.definition.description}</p>
  </header>
  <ChartRenderer {result} {selection} {sector} {staticMode} />
{:else if !result}
  <p role="alert">The chart URL is incomplete.</p>
{/if}
