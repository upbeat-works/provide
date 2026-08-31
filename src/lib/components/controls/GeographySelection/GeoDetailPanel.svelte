<script>
  import { GEOGRAPHY_INDEX, GEOGRAPHY_TYPES } from '$stores/meta.js';
  import { CURRENT_GEOGRAPHY_UID } from '$stores/state.js';
  import { parentCountriesOf, continentOf, childSummary, plainLabel } from './geography-tree.js';

  export let geography; // selected geography object or undefined

  // One line under the map: what is selected, and what it contains (a country's
  // children) or what contains it (the country a city/basin/EEZ belongs to).
  // Tags that name another geography select it; counts are read-only.
  $: tags = tagsFor(geography, $GEOGRAPHY_INDEX, $GEOGRAPHY_TYPES);

  function tagsFor(geography, index, types) {
    if (!geography) return [];
    if (geography.geographyType !== 'admin0') {
      return parentCountriesOf(index, geography.uid).map((c) => ({ label: c.label, uid: c.uid }));
    }
    const counts = childSummary(index, geography.uid).map(({ type, count }) => {
      const def = types.find((x) => x.uid === type);
      const noun = count === 1 ? (def?.labelSingular ?? def?.label ?? type) : (def?.label ?? type);
      return { label: `${count} ${plainLabel(noun)}` };
    });
    if (counts.length) return counts;
    // A country with nothing to drill into still says where it sits.
    const continent = continentOf(index, geography.uid);
    return continent ? [{ label: continent.label }] : [];
  }
</script>

{#if geography && tags.length}
  <div class="mt-3 flex flex-wrap items-center justify-center gap-2 px-2">
    <span class="text-xs font-medium uppercase tracking-wider text-text-weaker">{geography.label}:</span>
    {#each tags as tag}
      {#if tag.uid}
        <button type="button" class="rounded-full bg-theme-50 px-3 py-1 text-xs text-theme-700 transition-colors hover:bg-theme-100" on:click={() => CURRENT_GEOGRAPHY_UID.set(tag.uid)}
          >{tag.label}</button
        >
      {:else}
        <span class="rounded-full bg-theme-50 px-3 py-1 text-xs text-theme-700">{tag.label}</span>
      {/if}
    {/each}
  </div>
{/if}
