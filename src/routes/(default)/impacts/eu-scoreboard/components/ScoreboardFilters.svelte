<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { PATH_EU_SCOREBOARD, PATH_IMPACT } from '$config';
  import FilterSelect from './FilterSelect.svelte';

  export let data;
  export let filters = ['region', 'sector', 'indicator', 'scenario', 'year'];

  const base = `/${PATH_IMPACT}/${PATH_EU_SCOREBOARD}`;
  const allCountries = { uid: 'all', label: 'All available countries' };
  $: ranking = !$page.url.pathname.replace(/\/$/, '').endsWith('/indicators');

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
    if (param === 'region') url.pathname = `${base}/indicators`;
    void goto(url, { keepFocus: true, noScroll: true });
  }
</script>

{#each shown as filter (filter.key)}
  {@const options = filter.options(data)}
  {@const selected = filter.selected(data)}
  {#if filter.key === 'region'}
    <FilterSelect
      label="Geography"
      options={[allCountries, ...choicesFor(options, selected).filter(({ uid }) => uid !== 'all')]}
      selected={ranking ? undefined : selected}
      placeholder="Search geography"
      panelWidth="w-[24.5rem]"
      buttonAllLabel={allCountries.label}
      on:change={({ detail }) => select('region', detail)}
    />
  {:else}
    <FilterSelect
      label={filter.label}
      options={choicesFor(options, selected)}
      {selected}
      placeholder={options.length > 8 ? filter.placeholder : undefined}
      buttonAllLabel={selected?.label ?? 'No data'}
      on:change={({ detail }) => select(filter.param, detail)}
    />
  {/if}
{/each}
