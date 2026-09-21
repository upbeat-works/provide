<script>
  import ThemeProvider from '$styles/ThemeProvider.svelte';
  import ImpactGeo from './ImpactGeo.svelte';

  export let year = 2050;
  export let staticMode = false;
  export let compare = false;
  export let displayOption = 'side-by-side';
  export let alternateComparison = false;
  export let unitComparison = false;

  const scenario = { uid: 'Low Demand', label: 'Low Demand', color: '#126782' };
  const comparisonScenario = { uid: '2020 Climate Policies', label: '2020 Climate Policies', color: '#9b2226' };
  const alternateScenario = { uid: 'Delayed Transition', label: 'Delayed Transition', color: '#9b2226' };
  const unitScenario = { uid: 'Current Policies', label: 'Current Policies', color: '#9b2226' };
  let selectedComparison;
  $: {
    selectedComparison = comparisonScenario;
    if (alternateComparison) selectedComparison = alternateScenario;
    if (unitComparison) selectedComparison = unitScenario;
  }
  $: scenarios = compare ? [scenario, selectedComparison] : [scenario];
  $: chartContext = {
    view: {
      status: 'ready',
      years: [2050, 2100],
      selection: {
        geography: 'Cameroon',
        indicator: 'Mean Temperature',
        instance: 'provide-internal',
        reference: '2011-2020 (Present Day)',
        time: 'Annual',
        spatial: 'Area',
        scenarios: scenarios.map(({ uid }) => uid),
      },
    },
    availableYears: [2050, 2100],
    geography: { uid: 'Cameroon', label: 'Cameroon', geoId: 'CMR', geographyType: 'admin0' },
    indicator: {
      uid: 'Mean Temperature',
      label: 'Mean Temperature',
      instance: 'provide-internal',
      unit: { uid: 'degrees-celsius', label: '°C' },
      colorScale: 'default',
      direction: 1,
    },
    scenarios,
    parameters: { time: 'Annual', reference: '2011-2020 (Present Day)', spatial: 'Area' },
    urlParams: {
      indicator: 'Mean Temperature',
      instance: 'provide-internal',
      geography: 'Cameroon',
      time: 'Annual',
      reference: '2011-2020 (Present Day)',
      spatial: 'Area',
    },
    static: staticMode,
  };
</script>

<ThemeProvider>
  <ImpactGeo {chartContext} {year} {displayOption} />
</ThemeProvider>
