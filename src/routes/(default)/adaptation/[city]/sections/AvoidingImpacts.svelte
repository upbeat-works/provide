<script>
  import ExplorerLink from './ExplorerLink.svelte';

  export let title = undefined;
  export let description = undefined;
  export let explorerUrl = undefined;
</script>

{#if title}
  <h4 class="text-xl font-bold mb-7">{title}</h4>
{/if}

<div class="flex gap-4 justify-between max-w-[45em]">
  {#if description}
    <p class="max-w-[40em] text-text-weaker">{description}</p>
  {/if}
  {#if explorerUrl}
    <ExplorerLink href={explorerUrl} />
  {/if}
</div>
