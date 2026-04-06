<script>
  import {
    AVAILABLE_SCENARIOS,
    CURRENT_SCENARIOS,
    CURRENT_SCENARIOS_UID,
    IS_EMPTY_INDICATOR,
    AVAILABLE_TIMEFRAMES,
    IS_COMBINATION_AVAILABLE_SCENARIO,
    IS_COMBINATION_AVAILABLE_INDICATOR,
    IS_EMPTY_GEOGRAPHY,
  } from '$stores/state.js';
  import { PATH_KEY_CONCEPTS, ANCHOR_EXPLAINER_SCENARIOS } from '$config';
  import SelectionModal from '$lib/components/controls/components/SelectionModal.svelte';
  import SelectionPanel from '$lib/components/controls/components/SelectionPanel.svelte';
  import PillGroup from '$lib/components/ui/PillGroup.svelte';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import ScenarioDetails from './ScenarioDetails.svelte';
  import ScenarioList from './ScenarioList.svelte';
  import { derived } from 'svelte/store';
  import { onMount } from 'svelte';

  let hoveredScenarioUid;
  let currentTimeframe;
  $: hasScenarioSelected = $CURRENT_SCENARIOS.length !== 0;

  $: multipleScenariosSelected = $CURRENT_SCENARIOS.length > 1;

  $: buttonLabel = hasScenarioSelected ? (multipleScenariosSelected ? `${$CURRENT_SCENARIOS.length} scenarios selected` : $CURRENT_SCENARIOS[0].label) : undefined;

  $: scenarios = $AVAILABLE_SCENARIOS.map((scenario) => {
    const current = $CURRENT_SCENARIOS.find((s) => s.uid === scenario.uid);
    const currentIndex = $CURRENT_SCENARIOS.indexOf(current);
    return {
      ...scenario,
      ...(current || {}),
      isSelected: !!current,
      isHighlighted: hoveredScenarioUid ? hoveredScenarioUid === scenario.uid : currentIndex === 0,
    };
  });

  onMount(() => {
    const current = scenarios.find((s) => ($CURRENT_SCENARIOS_UID ?? []).includes(s.uid));
    currentTimeframe = current?.endYear ?? $AVAILABLE_TIMEFRAMES.find((t) => !t.disabled)?.uid;
  });

  $: availableScenarios = currentTimeframe ? scenarios.filter((s) => s.endYear === currentTimeframe) : scenarios;
  $: chartScenarios = scenarios.filter((s) => s.endYear === currentTimeframe);

  $: renderedScenario = scenarios.find((s) => s.isHighlighted && s.endYear === currentTimeframe);

  const DISABLED = derived([IS_EMPTY_GEOGRAPHY, IS_EMPTY_INDICATOR, IS_COMBINATION_AVAILABLE_INDICATOR], ([$isEmptyGeography, $isEmptyIndicator, $isAvailableIndicator]) => {
    if ($isEmptyGeography) {
      return 'Select a geography first';
    }
    if ($isEmptyIndicator) {
      return 'Select an indicator first';
    }
    if (!$isAvailableIndicator) {
      return 'Select a valid indicator first';
    }
    return undefined;
  });
</script>

<SelectionModal
  label="Scenario"
  {buttonLabel}
  labelClass="mb-0 p-0 text-text-stronger uppercase text-xs leading-tight"
  buttonClass="text-sm p-0"
  warning={!$IS_EMPTY_INDICATOR && hasScenarioSelected && !$IS_COMBINATION_AVAILABLE_SCENARIO ? `Unavailable scenario${multipleScenariosSelected ? 's' : ''} selected` : undefined}
  placeholder={!hasScenarioSelected ? 'Select one or more scenarios' : undefined}
  disabled={$DISABLED}
  panelClass="max-w-4xl"
>
  <SelectionPanel>
    <svelte:fragment slot="header">
      <div class="flex items-center justify-between">
        <div>
          <span class="block text-xs uppercase tracking-widest text-theme-weaker mb-2">Pick a timeframe</span>
          <PillGroup bind:currentUid={currentTimeframe} options={$AVAILABLE_TIMEFRAMES} disabledMessage="No scenarios available for this indicator in this timeframe" />
        </div>
        <Button href={`/${PATH_KEY_CONCEPTS}#${ANCHOR_EXPLAINER_SCENARIOS}`}>
          Which scenario should I select?
          <LinkArrow />
        </Button>
      </div>
    </svelte:fragment>
    <svelte:fragment slot="sidebar">
      {#key currentTimeframe}
        <fieldset class="flex flex-col min-w-min py-2">
          <ScenarioList highlightedScenarioUid={renderedScenario?.uid} bind:hoveredScenarioUid scenarios={availableScenarios} currentFilterUid={currentTimeframe} />
        </fieldset>
      {/key}
    </svelte:fragment>
    <svelte:fragment slot="content">
      <div class="p-6 w-full">
        {#if renderedScenario}
          <ScenarioDetails scenario={renderedScenario} scenarios={chartScenarios} currentFilterUid={currentTimeframe} />
        {:else}
          <div class="p-4 flex items-center rounded text-contour-weak justify-center min-h-[60vh]">Hover over a scenario to view details</div>
        {/if}
      </div>
    </svelte:fragment>
  </SelectionPanel>
</SelectionModal>
