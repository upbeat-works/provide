<script>
  import FilterPill from '$lib/components/ui/FilterPill.svelte';

  export let city = undefined;
  export let geography = undefined;
  export let topics = [];
  export let scenarios = [];
  export let project = undefined;
</script>

{#if city || topics.length || scenarios.length || project}
  <div class="mr-12 pt-6 mt-6 border-t border-contour-weakest flex flex-col gap-6">
    {#if city}
      <div>
        <h4 class="text-xs font-bold uppercase tracking-wide text-theme-900 mb-2">Location</h4>
        <p class="font-medium text-theme-700">
          {city.label}{#if geography}<span class="text-theme-400"> · {geography.Title}</span>{/if}
        </p>
      </div>
    {/if}

    {#if topics.length}
      <div>
        <h4 class="text-xs font-bold uppercase tracking-wide text-theme-900 mb-2">Topics</h4>
        <div class="flex flex-wrap gap-2">
          {#each topics as topic}
            <FilterPill color="petrol">{topic.Title}</FilterPill>
          {/each}
        </div>
      </div>
    {/if}

    {#if scenarios.length}
      <div>
        <h4 class="text-xs font-bold uppercase tracking-wide text-theme-900 mb-2">Scenarios</h4>
        <div class="flex flex-wrap gap-2">
          {#each scenarios as scenario}
            <FilterPill color="petrol">{scenario.Label || scenario.Title}</FilterPill>
          {/each}
        </div>
      </div>
    {/if}

    {#if project}
      <div>
        <h4 class="font-bold text-theme-900 mb-2">Project</h4>
        <FilterPill color="petrol">{project.Title}</FilterPill>
      </div>
    {/if}
  </div>
{/if}
