<script>
  import Presets from './Presets.svelte';

  let selectedScenarios = [];
  const scenarioPresets = [
    { uid: 'preset-one', title: 'First preset', description: 'Preset description', timeframe: 2100, scenarios: ['one'] },
  ];

  function handleSelection(event) {
    selectedScenarios = event.detail.scenarios;
  }
</script>

<Presets {selectedScenarios} {scenarioPresets} selectedTimeframe={2100} on:selection={handleSelection} />
<button on:click={() => (selectedScenarios = ['two'])}>Select second scenario</button>
<output>{selectedScenarios.join(',')}</output>
