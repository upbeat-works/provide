<script>
  import FilterPill from '$lib/components/ui/FilterPill.svelte';

  export let city = undefined;
  export let geography = undefined;
  export let topics = [];
  export let scenarios = [];
  export let project = undefined;
</script>

{#if city || topics.length || scenarios.length || project}
  <div class="mr-12 pt-8 mt-2 border-t border-contour-weakest flex flex-col gap-6">
    {#if city}
      <div>
        <h4 class="text-xs font-bold uppercase tracking-wide text-theme-900 mb-2">Location</h4>
        <p class="text-sm font-medium text-theme-700">
          {city.label}{#if geography}&nbsp;·&nbsp;{geography.Title}{/if}
        </p>
      </div>
    {/if}

    {#if topics.length}
      <div>
        <h4 class="text-xs font-bold uppercase tracking-wide text-theme-900 mb-2">Topics</h4>
        <div class="flex flex-wrap gap-2">
          {#each topics as topic}
            <FilterPill color="petrol" class="cursor-default">{topic.Title}</FilterPill>
          {/each}
        </div>
      </div>
    {/if}

    {#if scenarios.length}
      <div>
        <h4 class="text-xs font-bold uppercase tracking-wide text-theme-900 mb-2">Scenarios</h4>
        <div class="flex flex-wrap gap-2">
          {#each scenarios as scenario}
            <FilterPill color="petrol" class="cursor-default">{scenario.label}</FilterPill>
          {/each}
        </div>
      </div>
    {/if}

    {#if project}
      <div>
        <h4 class="text-xs font-bold uppercase tracking-wide text-theme-900 mb-2">Project</h4>
        <FilterPill color="petrol" class="cursor-default">{project.Title}</FilterPill>
      </div>
    {/if}
  </div>
{/if}
