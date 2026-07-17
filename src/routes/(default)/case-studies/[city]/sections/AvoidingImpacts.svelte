<script>
  import ExplorerLink from './ExplorerLink.svelte';
  import FilterPill from '$lib/components/ui/FilterPill.svelte';

  export let title = undefined;
  export let description = undefined;
  export let explorerUrl = undefined;
  export let indicators = [];
  export let studyLocations = [];
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

{#if indicators.length || studyLocations.length}
  <div class="flex flex-wrap gap-6 mt-4">
    {#if indicators.length}
      <div>
        <h5 class="text-xs font-bold uppercase tracking-wide text-theme-900 mb-2">Indicators</h5>
        <div class="flex flex-wrap gap-2">
          {#each indicators as indicator}
            <FilterPill color="petrol" class="cursor-default">{indicator.label}</FilterPill>
          {/each}
        </div>
      </div>
    {/if}
    {#if studyLocations.length}
      <div>
        <h5 class="text-xs font-bold uppercase tracking-wide text-theme-900 mb-2">Study Locations</h5>
        <div class="flex flex-wrap gap-2">
          {#each studyLocations as location}
            <FilterPill color="petrol" class="cursor-default">{location.label}</FilterPill>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
