<script>
  import ThemeProvider from '$styles/ThemeProvider.svelte';
  import ImpactGeo from './ImpactGeo.svelte';

  export let year = 2050;

  const scenario = { uid: 'Low Demand', label: 'Low Demand', color: '#126782' };
  const chartContext = {
    view: {
      status: 'ready',
      legacyUrlParams: {
        geography: 'AFG',
        'geography-type': 'admin0',
        indicator: 'terclim-txx',
        time: 'annual',
      },
      scenarioPairs: [{ scenario, legacyUid: 'ld' }],
    },
    geography: { uid: 'Afghanistan', label: 'Afghanistan', geoId: 'AFG', geographyType: 'admin0' },
    indicator: {
      uid: 'Annual Maximum Temperature',
      label: 'Annual Maximum Temperature',
      instance: 'provide-internal',
      unit: { uid: 'degrees-celsius', label: '°C' },
      colorScale: 'default',
      direction: 1,
    },
    scenarios: [scenario],
    parameters: { time: 'Annual' },
    urlParams: {
      indicator: 'Annual Maximum Temperature',
      instance: 'provide-internal',
      geography: 'Afghanistan',
      time: 'Annual',
    },
    static: true,
  };
</script>

<ThemeProvider>
  <ImpactGeo {chartContext} {year} />
</ThemeProvider>
