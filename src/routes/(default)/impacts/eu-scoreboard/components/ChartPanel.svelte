<script>
  import ScoreboardSection from '$lib/components/layouts/ScoreboardSection.svelte';
  import ChartRenderer from './charts/ChartRenderer.svelte';
  import SeriesPicker from './SeriesPicker.svelte';
  import { isChartVisible } from './charts/adapter.js';
  import { PATH_ADAPTATION } from '$config';
  import { loadResource } from './resource.js';
  import { assignColors, colorOf, defaultSelection, filterGroups, groupsOf, isPickable, SERIES_COLORS } from './series-filter.js';

  export let definition;
  export let result;
  export let selection;
  export let sector;

  // The result is resolved into a variable rather than awaited in the markup:
  // the picker's state is derived from the groups it carries, and an `{#await}`
  // block keeps that value out of reach of the reactive statements below.
  let chart;
  let settled = 0;
  let selected = [];
  let slots = {};
  let groupsKey;

  $: sync(result);
  $: groups = groupsOf(chart);
  $: syncSelection(groups);
  // Several groups to choose between, on a chart kind the picker suits.
  $: pickable = isPickable(chart?.definition?.chartType, groups);
  // What the groups actually are, so the picker does not caption NUTS regions
  // or scenarios as countries.
  $: pickerLabel = chart?.definition?.data?.groupBy === 'scenario' ? 'Scenarios' : selection.region?.uid === 'all' ? 'Countries' : 'Regions';
  $: slots = assignColors(slots, selected, SERIES_COLORS.length);
  $: colors = Object.fromEntries(Object.entries(slots).map(([uid, slot]) => [uid, colorOf(slot)]));
  $: shown = pickable ? filterGroups(chart, selected) : chart;
  // Held in a variable rather than written inline in the template: an arrow
  // created there is a new identity on every update, which re-runs the
  // renderer's adapt step and rebuilds the figure continuously.
  $: colorFor = pickable ? (uid) => colors[uid] : undefined;

  const failed = () => ({ definition, status: 'error', error: 'Chart data could not be loaded.', data: [] });

  // A result that is already a value is taken synchronously: the page hands one
  // over on first render, and deferring it by even a microtask would blank the
  // chart between every selection change.
  function sync(input) {
    const token = ++settled;
    if (typeof input?.then !== 'function') {
      chart = input;
      return;
    }
    chart = undefined;
    input.then(
      (next) => token === settled && (chart = next),
      () => token === settled && (chart = failed())
    );
  }

  // Groups change under the picker whenever the selection above the page does.
  // A choice the reader made survives as long as those groups are still there;
  // a wholly new set starts from the default again.
  function syncSelection(next) {
    const key = next.map(({ uid }) => uid).join('|');
    if (key === groupsKey) return;
    groupsKey = key;
    const uids = new Set(next.map(({ uid }) => uid));
    const kept = selected.filter((uid) => uids.has(uid));
    selected = kept.length ? kept : defaultSelection(next);
  }

  function retry() {
    sync(loadResource(`charts/${encodeURIComponent(definition.chartId)}`, sector, selection).catch(failed));
  }
</script>

{#if !chart || chart.status === 'loading'}
  <p class="py-8" role="status">Loading {definition.title}…</p>
{:else if isChartVisible(chart, selection)}
  <ScoreboardSection eyebrow={selection.region?.label ?? 'No region'} slug={definition.chartId} title={definition.title} description={definition.description}>
    {#if chart.caseStudy?.slug}
      <a class="mb-4 block text-sm font-bold text-theme-base" href="/{PATH_ADAPTATION}/{chart.caseStudy.slug}">See {chart.caseStudy.title ?? 'case study'} →</a>
    {/if}

    {#if pickable}
      <SeriesPicker label={pickerLabel} {groups} bind:selected {colors} />
    {/if}

    {#if pickable && !selected.length}
      <!-- Clearing the picker empties the chart, but the picker has to stay on
           screen or there is no way to choose again. -->
      <p class="py-8 text-sm text-text-weaker" role="status">No {pickerLabel.toLowerCase()} selected.</p>
    {:else}
      <ChartRenderer result={shown} {selection} {sector} {retry} {colorFor} hideLegend={pickable} />
    {/if}
  </ScoreboardSection>
{/if}
