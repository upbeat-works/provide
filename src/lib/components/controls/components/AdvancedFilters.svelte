<script>
  import Button from '$lib/components/ui/Button.svelte';
  import ExpandIcon from '$lib/components/icons/Expand.svelte';
  import FilterPill from '$lib/components/ui/FilterPill.svelte';
  import { FACET_FILTERS, FACET_GROUPS } from '$stores/state.js';
  import { toggleFacetValue, clearFacetGroup, activeFacetGroupCount } from '$stores/facet-selection.js';

  let isOpen = false;

  // Written out in full so Tailwind can see the class names (it cannot resolve
  // interpolated ones). Keys match FilterPill's palette.
  const dotClasses = {
    petrol: 'bg-petrol-600',
    grass: 'bg-grass-600',
    pink: 'bg-pink-600',
    orange: 'bg-orange-700',
    sky: 'bg-sky-600',
    gray: 'bg-gray-500',
  };

  // Groups (keys, labels, colours) and their discovered values both come from
  // the API — nothing about the vocabulary is known ahead of time here.
  $: selectedOf = (key) => $FACET_FILTERS[key] ?? [];
  $: groups = $FACET_GROUPS.filter((group) => group.options.length || selectedOf(group.key).length);
  $: activeGroupCount = activeFacetGroupCount($FACET_FILTERS);

  const toggle = (key, value) => FACET_FILTERS.update(($f) => toggleFacetValue($f, key, value));
  const clearGroup = (key) => FACET_FILTERS.update(($f) => clearFacetGroup($f, key));
</script>

{#if groups.length}
  <div class="mt-3 border-t border-contour-weakest pt-3">
    <Button variant="secondary" class="!px-2 !py-0.5 text-sm font-medium bg-petrol-100" on:click={() => (isOpen = !isOpen)}>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="8" y1="12" x2="16" y2="12" />
        <line x1="11" y1="18" x2="13" y2="18" />
      </svg>
      Advanced Filters
      {#if activeGroupCount > 0}
        <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-theme-base text-surface-base text-xs font-medium">
          {activeGroupCount}
        </span>
      {/if}
      <ExpandIcon class="stroke-current stroke-[1.5]" />
    </Button>

    {#if isOpen}
      <div class="mt-3 p-4 bg-surface-weaker border border-contour-weakest rounded grid grid-cols-3 gap-x-6 gap-y-5">
        {#each groups as group (group.key)}
          <div>
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full {dotClasses[group.color] ?? dotClasses.petrol} inline-block"></span>
                <span class="text-xs font-bold tracking-widest text-text-weaker uppercase">{group.label}</span>
              </div>
              {#if selectedOf(group.key).length}
                <button
                  class="text-xs text-text-weaker hover:text-text-base transition-colors"
                  on:click={() => clearGroup(group.key)}
                >
                  Clear ×
                </button>
              {/if}
            </div>
            <div class="flex flex-wrap gap-1.5">
              {#each group.options as option (option.value)}
                <FilterPill
                  color={group.color}
                  selected={selectedOf(group.key).includes(option.value)}
                  count={option.count}
                  on:click={() => toggle(group.key, option.value)}
                >{option.value}</FilterPill>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
