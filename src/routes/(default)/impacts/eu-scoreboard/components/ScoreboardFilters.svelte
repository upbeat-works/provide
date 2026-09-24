<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import FilterSelect from './FilterSelect.svelte';

  // The scoreboard's control bar, built from the same popover pickers the rest
  // of the site selects with, so the bar reads like explore's. What differs is
  // only where a choice goes: the scoreboard's selection lives in the URL and
  // drives the server load, so a pick navigates rather than setting a store.
  export let data;
  export let filters = ['region', 'sector', 'indicator', 'scenario', 'year'];

  const FIELDS = {
    sector: { label: 'Topic', param: 'sector', options: (d) => d.scoreboard.sectors, selected: (d) => d.scoreboard.sector },
    indicator: { label: 'Indicator', param: 'indicator', options: (d) => d.indicators ?? [], selected: (d) => d.selection?.indicator },
    region: { label: 'Geography', param: 'region', options: (d) => d.regions ?? [], selected: (d) => d.selection?.region, placeholder: 'Search geography' },
    scenario: { label: 'Scenario', param: 'scenario', options: (d) => d.scenarios ?? [], selected: (d) => d.selection?.scenario },
    year: { label: 'Year', param: 'year', options: (d) => d.years ?? [], selected: (d) => d.selection?.year },
  };
  $: shown = filters.flatMap((key) => (FIELDS[key] ? [{ key, ...FIELDS[key] }] : []));

  // A selection the options do not cover still has to name itself — a year the
  // scenario does not reach, or an area whose data has gone. It is offered
  // alongside the rest rather than silently swapped for something else.
  const choicesFor = (options, selected) => (selected && !options.some(({ uid }) => uid === selected.uid) ? [selected, ...options] : options);

  function select(param, option) {
    if (!option?.uid) return;
    const url = new URL($page.url);
    url.searchParams.set(param, option.uid);
    void goto(url, { keepFocus: true, noScroll: true });
  }
</script>

{#each shown as filter (filter.key)}
  {@const options = filter.options(data)}
  {@const selected = filter.selected(data)}
  <FilterSelect
    label={filter.label}
    options={choicesFor(options, selected)}
    {selected}
    placeholder={options.length > 8 ? filter.placeholder : undefined}
    buttonAllLabel={selected?.label ?? 'No data'}
    on:change={({ detail }) => select(filter.param, detail)}
  />
{/each}
