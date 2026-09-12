<script>
  import Presets from './Presets.svelte';
  import CrossLink from './CrossLink.svelte';
  import Chart from './Chart.svelte';
  import Table from './Table/Table.svelte';
  import SectionContent from '$src/lib/components/layouts/SectionContent.svelte';
  import PillGroup from '$lib/components/ui/PillGroup.svelte';
  import { writable } from 'svelte/store';
  import { extractEndYear } from '$utils/meta.js';
  import THEME from '$styles/theme-store.js';
  import { LABEL_SCENARIOS_TIMELINES, LABEL_SCENARIOS_TIMEFRAMES, MEAN_TEMPERATURE_UID, EMISSIONS_UID, PATH_DOCUMENTATION } from '$config';
  import DefinitionItem from '$lib/components/charts/DefinitionItem.svelte';
  import { methodologyExplorerScenarioIds, methodologyScenarioKey, methodologyScenarioKeys, methodologyScenarioSelectionKeys } from '$lib/catalog/methodology-scenarios.js';

  export let scenarios;
  export let selectableTimeframes;
  export let defaultTimeframe;
  export let scenarioPresets;

  $: selectedTimeframe = defaultTimeframe;
  $: scenariosListed = scenarios
    .filter((s) => extractEndYear(s) === selectedTimeframe)
    .map((scenario) => {
      const selectionKey = methodologyScenarioKey(scenario);
      const scenarioSelectedIndex = $selectedScenarioKeys.indexOf(selectionKey);
      const isSelected = scenarioSelectedIndex >= 0;
      const color = isSelected ? $THEME.color.category.base[scenarioSelectedIndex] : undefined;
      return {
        ...scenario,
        selectionKey,
        isSelected,
        color,
      };
    });

  const selectedScenarioKeys = writable([]);
  $: explorerScenarioIds = methodologyExplorerScenarioIds(scenarios, $selectedScenarioKeys);
  $: selectedInstances = [...new Set(scenarios.filter((scenario) => $selectedScenarioKeys.includes(methodologyScenarioKey(scenario))).map((scenario) => scenario.instance))];
  $: explorerInstance = selectedInstances.length === 1 ? selectedInstances[0] : undefined;
  $: sourceBoundPresets = scenarioPresets.map((preset) => ({
    ...preset,
    scenarios: methodologyScenarioKeys(scenarios, preset.scenarios),
  }));

  function handlePreset(event) {
    selectedScenarioKeys.set(methodologyScenarioSelectionKeys(scenarios, event.detail.scenarios));
  }
</script>

<div class="flex flex-col gap-y-10 mt-10 pt-10">
  <div>
    <SectionContent title={LABEL_SCENARIOS_TIMEFRAMES} subtitle="2100 for the majority of climate impacts, 2300 for longer term impacts (glaciers and oceans)." />
    <PillGroup bind:currentUid={selectedTimeframe} options={selectableTimeframes} />
  </div>

  <Presets {selectedTimeframe} selectedScenarios={$selectedScenarioKeys} on:selection={handlePreset} scenarioPresets={sourceBoundPresets} />

  <Table {scenariosListed} {selectedTimeframe} bind:selectedScenarios={$selectedScenarioKeys} />
  <footer class="grid gap-x-6 gap-y-6 grid-cols-1 md:grid-cols-2">
    <CrossLink selectedScenarios={explorerScenarioIds} instance={explorerInstance} />
  </footer>
  <div>
    <SectionContent title={LABEL_SCENARIOS_TIMELINES} subtitle="Select a scenario to see progress over time." />
    <div class="grid gap-x-6 gap-y-6 lg:grid-cols-2">
      <Chart scenarios={scenariosListed} variable={MEAN_TEMPERATURE_UID} title="Global mean temperature in °C" yDomain={[1, null]}>
        <p class="mt-1 mb-2 text-contour-weaker">
          The lines in the graph represent best estimates. Learn more about uncertainties <a class="underline decoration-theme-weakest hover:decoration-theme-weaker" href="/{PATH_DOCUMENTATION}"
            >here</a
          >.
        </p>
        <dl class="flex gap-4">
          <DefinitionItem term="Model" definition="FaIR v1.6.4" />
          <DefinitionItem term="Source" definition="Lamboll et al., 2022" href="https://essopenarchive.org/doi/full/10.1002/essoar.10511875.1" />
        </dl>
      </Chart>
      <Chart scenarios={scenariosListed} variable={EMISSIONS_UID} title="Global greenhouse gas emissions in GtCO₂eq/yr" yDomain={[null, null]}>
        <p class="mt-1 mb-2 text-contour-weaker">
          The lines in the graph represent best estimates. Learn more about uncertainties <a class="underline decoration-theme-weakest hover:decoration-theme-weaker" href="/{PATH_DOCUMENTATION}"
            >here</a
          >.
        </p>
        <dl class="flex gap-4">
          <DefinitionItem term="Model" definition="FaIR v1.6.4" />
          <DefinitionItem term="Source" definition="Lamboll et al., 2022" href="https://essopenarchive.org/doi/full/10.1002/essoar.10511875.1" />
        </dl>
      </Chart>
    </div>
  </div>
</div>
