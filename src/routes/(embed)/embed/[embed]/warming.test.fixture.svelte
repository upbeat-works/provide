<script>
  import ThemeProvider from '$styles/ThemeProvider.svelte';
  import { scenariosForTimeframe } from '$stores/catalog-adapters.js';
  import UnavoidableRisk from '$routes/(default)/impacts/components/UnavoidableRisk/UnavoidableRisk.svelte';
  import Page from './+page.svelte';

  export let embed = false;

  const selectedScenarios = [{ uid: 'High ambition', label: 'High ambition', endYear: 2050, color: '#126782' }];
  const availableScenarios = [
    { uid: 'High ambition', label: 'High ambition', endYear: 2050 },
    { uid: 'Current policies', label: 'Current policies', endYear: 2050 },
    { uid: 'Low risk later', label: 'Low risk later', endYear: 2100 },
  ];
  const allScenarios = scenariosForTimeframe({ selectedScenarios, allScenarios: availableScenarios });
  const chartContext = {
    view: { status: 'ready' },
    static: false,
    indicator: {
      uid: 'Heat risk',
      id: 'Heat risk',
      instance: 'provide-internal',
      label: 'Heat risk label',
      unit: { uid: 'days', label: 'days' },
    },
    geography: { uid: 'DEU', id: 'DEU', label: 'Germany' },
    scenarios: selectedScenarios,
    allScenarios,
    parameters: { time: 'Annual' },
    urlParams: { indicator: 'Heat risk', instance: 'provide-internal', geography: 'DEU', time: 'Annual' },
    unitUid: 'days',
  };
</script>

<ThemeProvider>
  {#if embed}
    <Page />
  {:else}
    <UnavoidableRisk {chartContext} threshold={20} />
  {/if}
</ThemeProvider>
