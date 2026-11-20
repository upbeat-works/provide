<script>
  import ChartRenderer from './ChartRenderer.svelte';
  import SeriesPicker from '../SeriesPicker.svelte';
  import { assignColors, colorOf, defaultSelection, filterGroups, groupsOf, isPickable, SERIES_COLORS } from '../series-filter.js';

  export let result;
  export let selection = {};
  export let staticMode = false;
  export let retry = undefined;

  let selected = [];
  let slots = {};
  let groupsKey;

  $: groups = groupsOf(result);
  $: syncSelection(groups);
  $: pickable = isPickable(result?.definition?.chartType, groups);
  $: pickerLabel = labelForGroups(result, selection);
  $: slots = assignColors(slots, selected, SERIES_COLORS.length);
  $: colors = Object.fromEntries(Object.entries(slots).map(([uid, slot]) => [uid, colorOf(slot)]));
  $: shown = pickable ? filterGroups(result, selected) : result;
  // Keep the callback stable between renders to avoid repeated chart updates.
  $: colorFor = pickable ? (uid) => colors[uid] : undefined;

  function labelForGroups(result, selection) {
    if (result?.definition?.data?.groupBy === 'scenario') return 'Scenarios';
    if (selection.region?.uid === 'all') return 'Countries';
    return 'Regions';
  }

  function syncSelection(next) {
    const key = next.map(({ uid }) => uid).join('|');
    if (key === groupsKey) return;
    groupsKey = key;
    const uids = new Set(next.map(({ uid }) => uid));
    const kept = selected.filter((uid) => uids.has(uid));
    selected = kept.length ? kept : defaultSelection(next);
  }
</script>

{#if pickable}
  <SeriesPicker label={pickerLabel} {groups} bind:selected {colors} />
{/if}

{#if pickable && !selected.length}
  <p class="py-8 text-sm text-text-weaker" role="status">No {pickerLabel.toLowerCase()} selected.</p>
{:else}
  <ChartRenderer result={shown} {selection} {retry} {colorFor} hideLegend={pickable} {staticMode} />
{/if}
