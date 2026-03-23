<script>
  import Select from '$lib/components/ui/Select.svelte';
  import SegmentedControl from '$lib/components/controls/SegmentedControl.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';

  export let displayOption;
  export let displayOptions;
  export let yearOptions;
  export let scenarios;
  export let year;
  export let showSatellite;
  export let showSatelliteOption;

  $: yearOptionsList = yearOptions.map((year) => ({ uid: year, label: String(year) }));
</script>

<div class="flex items-center gap-6">
  {#if scenarios.length === 2}
    <SegmentedControl options={displayOptions} bind:value={displayOption} />
  {/if}
  <Select options={yearOptionsList} labelClass="mr-1" bind:value={year} label="Year" />
  {#if showSatelliteOption}
    <Switch bind:value={showSatellite} label="Show satellite" />
  {/if}
</div>
