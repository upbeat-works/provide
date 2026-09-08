<script>
  import { chartBySlug, charts } from './catalog.js';

  // One scoreboard chart on its own, for `/embed/eu-scoreboard-chart?chart=<slug>`.
  // This is what the graph download screenshots, so it carries the heading the
  // section around the chart would otherwise supply.
  export let chart = undefined;

  $: entry = chartBySlug(chart) ?? charts[0];
</script>

{#if entry}
  <div class="flex flex-col gap-4">
    <header class="max-w-prose">
      <h1 class="mb-3 text-2xl font-normal">{entry.title}</h1>
      <p class="leading-relaxed">{entry.description}</p>
    </header>
    <svelte:component this={entry.component} {...entry.props} chartInfo={entry.info} />
  </div>
{/if}
