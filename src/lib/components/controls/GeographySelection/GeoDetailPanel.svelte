<script>
  import { GEOGRAPHY_INDEX, GEOGRAPHY_TYPES } from '$stores/meta.js';
  import { CURRENT_GEOGRAPHY_UID } from '$stores/state.js';
  import { parentCountriesOf, continentOf, childSummary } from './geography-tree.js';

  export let geography; // selected geography object or undefined

  $: type = geography ? $GEOGRAPHY_TYPES.find((t) => t.uid === geography.geographyType) : null;
  $: isCountry = geography?.geographyType === 'admin0';
  $: icon = geography ? (geography.icon ?? geography.emoji) : null;
  $: continent = geography ? continentOf($GEOGRAPHY_INDEX, geography.uid) : null;
  $: parentCountries = geography && !isCountry ? parentCountriesOf($GEOGRAPHY_INDEX, geography.uid) : [];
  $: breakdown = isCountry
    ? childSummary($GEOGRAPHY_INDEX, geography.uid).map(({ type: t, count }) => {
        const def = $GEOGRAPHY_TYPES.find((x) => x.uid === t);
        const noun = count === 1 ? (def?.labelSingular ?? def?.label ?? t) : (def?.label ?? t);
        return { type: t, count, label: `${count} ${noun}` };
      })
    : [];
</script>

{#if geography}
  <div class="mt-3 rounded-lg border border-contour-weakest p-3 text-sm">
    <div class="flex items-center gap-2">
      {#if icon}<i class="not-italic font-emoji font-normal" aria-hidden role="presentation">{icon}</i>{/if}
      <span class="font-bold text-theme-base truncate">{geography.label}</span>
      {#if type}<span class="rounded-full bg-surface-weaker px-2 py-0.5 text-xs text-text-weaker">{type.labelSingular ?? type.label}</span>{/if}
    </div>

    {#if isCountry && continent}
      <p class="mt-1 text-xs text-text-weaker">{continent.label}</p>
    {/if}

    {#if !isCountry && parentCountries.length === 1}
      <p class="mt-2 text-xs text-text-weaker">Country: <span class="text-theme-base">{parentCountries[0].label}</span></p>
    {/if}

    {#if !isCountry && parentCountries.length > 1}
      <div class="mt-2">
        <span class="text-xs uppercase tracking-wide text-text-weaker">Also linked to</span>
        <div class="mt-1 flex flex-wrap gap-1">
          {#each parentCountries as c}
            <button type="button" class="rounded-md bg-surface-weaker px-2 py-1 text-xs text-theme-base hover:bg-surface-weak" on:click={() => CURRENT_GEOGRAPHY_UID.set(c.uid)}>{c.label}</button>
          {/each}
        </div>
      </div>
    {/if}

    {#if breakdown.length}
      <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {#each breakdown as tag}
          <span class="rounded-full border border-contour-weak px-2 py-0.5 text-theme-base">{tag.label}</span>
        {/each}
      </div>
    {/if}
  </div>
{/if}
