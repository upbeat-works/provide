<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  export let scoreboard;

  function selectSector(event) {
    const url = new URL($page.url);
    url.searchParams.set('sector', event.currentTarget.value);
    void goto(url, { keepFocus: true, noScroll: true });
  }
</script>

<label class="flex min-w-[10rem] flex-col text-sm">
  <span>Hazard/Sector</span>
  <select class="mt-1 bg-transparent font-semibold" value={scoreboard.sector.uid} on:change={selectSector}>
    {#each scoreboard.sectors as sector (sector.uid)}
      <option value={sector.uid}>{sector.label}</option>
    {/each}
  </select>
</label>
