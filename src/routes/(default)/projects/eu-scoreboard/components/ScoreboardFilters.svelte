<script>
  import { goto, invalidate } from '$app/navigation';
  import { page } from '$app/stores';
  import SectorSelect from './SectorSelect.svelte';

  export let data;

  const filters = [
    { key: 'scenario', label: 'Scenario', options: 'scenarios' },
    { key: 'region', label: 'Region', options: 'regions' },
    { key: 'year', label: 'Year', options: 'years' },
  ];
  function select(key, event) {
    const url = new URL($page.url);
    url.searchParams.set(key, event.currentTarget.value);
    void goto(url, { keepFocus: true, noScroll: true });
  }
</script>

<SectorSelect scoreboard={data.scoreboard} />
{#each filters as filter (filter.key)}
  {@const options = data[filter.options] ?? []}
  {@const selected = data.selection?.[filter.key]}
  <label class="flex min-w-[8rem] flex-col text-sm">
    <span>{filter.label}</span>
    <select aria-label={filter.label} class="mt-1 bg-transparent font-semibold" disabled={!options.length} value={selected?.uid} on:change={(event) => select(filter.key, event)}>
      {#if selected && !options.some(({ uid }) => uid === selected.uid)}
        <option value={selected.uid}>{selected.label}</option>
      {:else if !options.length}
        <option value={selected?.uid}>{selected?.label ?? 'No data'}</option>
      {/if}
      {#each options as option (option.uid)}<option value={option.uid}>{option.label}</option>{/each}
    </select>
  </label>
{/each}
{#if data.scoreboardOptions?.status === 'error' || data.scoreboardOptions?.yearStatus === 'error'}
  <div role="alert" class="text-sm">
    <p>{data.scoreboardOptions.error ?? data.scoreboardOptions.yearError}</p>
    <button type="button" class="font-bold" on:click={() => invalidate('scoreboard:options')}>Retry choices</button>
  </div>
{/if}
