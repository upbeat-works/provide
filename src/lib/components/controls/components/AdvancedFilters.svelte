<script>
  import Button from '$lib/components/ui/Button.svelte';
  import ExpandIcon from '$lib/components/icons/Expand.svelte';
  import FilterPill from '$lib/components/ui/FilterPill.svelte';

  let isOpen = false;

  const filterGroups = [
    {
      key: 'sector', label: 'SECTOR', dotClass: 'bg-grass-600', color: 'grass',
      options: [
        { uid: 'agriculture', label: 'Agriculture', count: 4 },
        { uid: 'energy', label: 'Eenergy', count: 5 },
        { uid: 'health', label: 'Health', count: 4 },
        { uid: 'infrastructure', label: 'Infrastructure', count: 3 },
        { uid: 'forestry', label: 'Forestry', count: 7 },
        { uid: 'coastal-zones', label: 'Coastal Zones', count: 4 },
      ],
    },
    {
      key: 'project', label: 'PROJECT', dotClass: 'bg-pink-600', color: 'pink',
      options: [
        { uid: 'sparccle', label: 'SPARCCLE', count: 6 },
        { uid: 'provide', label: 'PROVIDE', count: 10 },
        { uid: 'other', label: 'Other', count: 4 },
      ],
    },
    {
      key: 'dataSource', label: 'DATA SOURCE', dotClass: 'bg-gray-500', color: 'gray',
      options: [
        { uid: 'format1', label: 'Format1', count: 9 },
        { uid: 'format2', label: 'Format2', count: 4 },
        { uid: 'format3', label: 'Format3', count: 5 },
      ],
    },
    {
      key: 'spatialResolution', label: 'SPATIAL RESOLUTION', dotClass: 'bg-orange-700', color: 'orange',
      options: [
        { uid: 'global', label: 'Global', count: 9 },
        { uid: 'regional', label: 'Regional', count: 7 },
        { uid: 'national', label: 'National', count: 3 },
        { uid: 'sub-national', label: 'Sub-national', count: 1 },
      ],
    },
    {
      key: 'temporal', label: 'TEMPORAL', dotClass: 'bg-sky-600', color: 'sky',
      options: [
        { uid: 'annual', label: 'Anual', count: 12 },
        { uid: 'monthly', label: 'Monthly', count: 4 },
        { uid: 'daily', label: 'Daily', count: 1 },
        { uid: 'seasonal', label: 'Seasonal', count: 2 },
      ],
    },
  ];

  let selectedFilters = {
    sector: new Set(),
    project: new Set(),
    dataSource: new Set(),
    spatialResolution: new Set(),
    temporal: new Set(),
  };

  $: activeGroupCount = Object.values(selectedFilters).filter((s) => s.size > 0).length;

  function toggle(groupKey, uid) {
    const set = new Set(selectedFilters[groupKey]);
    set.has(uid) ? set.delete(uid) : set.add(uid);
    selectedFilters = { ...selectedFilters, [groupKey]: set };
  }

  function clearGroup(groupKey) {
    selectedFilters = { ...selectedFilters, [groupKey]: new Set() };
  }
</script>

<div class="mt-3 border-t border-contour-weakest pt-3">
  <Button variant="secondary" class="!px-2 !py-0.5 text-xs font-medium bg-petrol-100" on:click={() => (isOpen = !isOpen)}>
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
    <div class="mt-3 p-4 bg-white border border-contour-weakest rounded grid grid-cols-3 gap-x-6 gap-y-5">
      {#each filterGroups as group}
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full {group.dotClass} inline-block"></span>
              <span class="text-xs font-bold tracking-widest text-text-weaker uppercase">{group.label}</span>
            </div>
            {#if selectedFilters[group.key].size > 0}
              <button
                class="text-xs text-text-weaker hover:text-text-base transition-colors"
                on:click={() => clearGroup(group.key)}
              >
                Clear ×
              </button>
            {/if}
          </div>
          <div class="flex flex-wrap gap-1.5">
            {#each group.options as option}
              <FilterPill
                color={group.color}
                selected={selectedFilters[group.key].has(option.uid)}
                count={option.count}
                on:click={() => toggle(group.key, option.uid)}
              >{option.label}</FilterPill>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
