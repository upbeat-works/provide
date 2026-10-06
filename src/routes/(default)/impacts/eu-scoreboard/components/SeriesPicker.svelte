<script>
  import { pageItems, rangeLabel } from './series-filter.js';

  // Which groups a grouped chart draws, chosen above the chart it controls.
  // Selecting "all countries" otherwise puts one mark per country on every
  // figure — forty lines, which is more ink than anyone can read.
  export let label = 'Countries';
  export let groups = [];
  export let selected = [];
  // uid → the colour that group is drawn in, when the chart colours by group.
  // Without it the boxes are plain, rather than claiming a colour the chart
  // does not use.
  export let colors = undefined;

  let page = 1;

  // Groups can change under the picker when the scenario or year changes, so
  // paging reads the clamped page back off `view` rather than trusting its own
  // counter, which could otherwise drift past the end and show nothing.
  $: view = pageItems(groups, page);
  $: resetPage(groups);
  $: chosen = new Set(selected);

  let groupsKey;
  function resetPage(next) {
    const key = next.map(({ uid }) => uid).join('|');
    if (key === groupsKey) return;
    groupsKey = key;
    page = 1;
  }

  const toggle = (uid) => {
    selected = chosen.has(uid) ? selected.filter((value) => value !== uid) : [...selected, uid];
  };
</script>

<div class="mb-6 flex flex-col gap-3">
  <div class="flex items-center justify-between gap-4">
    <p class="text-sm">
      <span class="font-semibold uppercase tracking-wider text-theme-stronger">{label}</span>
      <span class="ml-2 text-text-weaker">{rangeLabel(groups, page)}</span>
    </p>

    <div class="flex items-center gap-3">
      {#if selected.length}
        <button type="button" class="text-sm font-semibold text-theme-base hover:underline" on:click={() => (selected = [])}>Clear all</button>
      {/if}
      {#if view.pages > 1}
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded border border-contour-weakest text-theme-base disabled:text-contour-weakest"
            on:click={() => (page = view.page - 1)}
            disabled={view.page === 1}
            aria-label="Previous page"
          >‹</button>
          <span class="text-sm tabular-nums text-text-weaker">{view.page} / {view.pages}</span>
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded border border-contour-weakest text-theme-base disabled:text-contour-weakest"
            on:click={() => (page = view.page + 1)}
            disabled={view.page === view.pages}
            aria-label="Next page"
          >›</button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Five to a row on a wide screen, collapsing to two: the names are short
       and a single column would push the chart off the screen. -->
  <ul class="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
    {#each view.items as { uid, label: name } (uid)}
      {@const checked = chosen.has(uid)}
      {@const color = colors?.[uid]}
      <li>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-theme-stronger">
          <input
            type="checkbox"
            class="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-sm border border-contour-weaker bg-surface-base checked:border-transparent"
            style={checked && color ? `background-color: ${color}` : undefined}
            class:checked-mark={checked}
            class:bg-theme-base={checked && !color}
            {checked}
            on:change={() => toggle(uid)}
          />
          {name}
        </label>
      </li>
    {/each}
  </ul>
</div>

<style lang="postcss">
  /* The tick is drawn on the box itself so the swatch stays the group's colour
     underneath it, which a background image on `checked:` alone cannot do. */
  .checked-mark {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3.5 8.5 3 3 6-6'/%3E%3C/svg%3E");
    background-size: 100% 100%;
  }
</style>
