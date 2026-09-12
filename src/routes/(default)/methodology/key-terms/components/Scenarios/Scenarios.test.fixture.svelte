<script>
  import ThemeProvider from '$styles/ThemeProvider.svelte';
  import Scenarios from './Scenarios.svelte';
  import { KEY_SCENARIO_ENDYEAR } from '$config';

  const series = [
    { year: 2020, value: 1 },
    { year: 2100, value: 2 },
  ];
  const scenarios = [
    {
      id: 'one',
      uid: 'one',
      instance: 'provide-internal',
      label: 'First scenario',
      [KEY_SCENARIO_ENDYEAR]: 2100,
      characteristics: {},
      gmt: series,
      emissions: series,
    },
  ];
</script>

<ThemeProvider>
  <Scenarios
    {scenarios}
    selectableTimeframes={[{ uid: 2100, label: '2100' }]}
    defaultTimeframe={2100}
    scenarioPresets={[{ uid: 'first-preset', title: 'First preset', description: 'Preset description', timeframe: 2100, scenarios: ['one'] }]}
  />
</ThemeProvider>
