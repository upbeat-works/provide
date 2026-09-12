<script>
  import NestedNav from './NestedNav.svelte';

  let contentRef;
  let showLateSections = false;
  let useReplacement = false;
  let scenarioTitle = 'Scenario list';
</script>

<button on:click={() => (showLateSections = true)}>Load sections</button>
<button on:click={() => (showLateSections = false)}>Remove sections</button>
<button on:click={() => (useReplacement = true)}>Replace content</button>
<button on:click={() => (scenarioTitle = 'Scenario catalogue')}>Rename section</button>

<NestedNav {contentRef} />

{#if useReplacement}
  <article bind:this={contentRef}>
    <h2>Replacement section</h2>
  </article>
{:else}
  <article bind:this={contentRef}>
    {#if showLateSections}
      <h2>{scenarioTitle}</h2>
      <h3>Scenario timelines</h3>
    {/if}
  </article>
{/if}
