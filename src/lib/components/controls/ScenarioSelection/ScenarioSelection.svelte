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
  import { extractEndYearFromScenarios } from '$lib/utils/utils.js';

  // By default the picker offers what ixmp4 has for the current indicator +
  // geography, and gates itself on that selection existing. A view with no
  // indicator selection to gate on (the scoreboard) passes its own scenario
  // universe instead, and owns the gating that comes with it.
  export let scenarios = undefined;
  export let disabled = undefined;
  // Explore compares scenarios; a view tied to one scenario passes false.
  export let multiple = true;
  // The control lives in a page's filter bar, so the bar sets its metrics.
  export let wrapperClass = undefined;
  export let labelClass = 'mb-0 p-0 text-text-stronger uppercase text-xs leading-tight';
  export let buttonClass = 'text-sm p-0';

  let hoveredScenarioUid;
  let currentTimeframe;
  $: hasScenarioSelected = $CURRENT_SCENARIOS.length !== 0;

  $: multipleScenariosSelected = $CURRENT_SCENARIOS.length > 1;

  $: buttonLabel = hasScenarioSelected ? (multipleScenariosSelected ? `${$CURRENT_SCENARIOS.length} scenarios selected` : $CURRENT_SCENARIOS[0].label) : undefined;

  // Whether the caller brought its own list — and with it, its own availability.
  $: owned = Boolean(scenarios);
  $: source = scenarios ?? $AVAILABLE_SCENARIOS;

  // Timeframe pills follow whichever list is in play.
  $: timeframes = owned ? extractEndYearFromScenarios(source, source.filter((s) => !s.disabled)) : $AVAILABLE_TIMEFRAMES;

  $: options = source.map((scenario) => {
    const current = $CURRENT_SCENARIOS.find((s) => s.uid === scenario.uid);
    const currentIndex = $CURRENT_SCENARIOS.indexOf(current);
    return {
      ...scenario,
      ...(current || {}),
      isSelected: !!current,
      isHighlighted: hoveredScenarioUid ? hoveredScenarioUid === scenario.uid : currentIndex === 0,
    };
  });

  // Open on the timeframe holding the current selection. The list lands after
  // mount — page data on hydration, the availability fetch after that — so this
  // picks the first time there is something to pick from rather than at mount,
  // where it found an empty list and left the pills with nothing selected (and
  // so every timeframe's scenarios in one list).
  $: if (currentTimeframe === undefined && timeframes.length) {
    const current = options.find((s) => ($CURRENT_SCENARIOS_UID ?? []).includes(s.uid));
    currentTimeframe = current?.endYear ?? timeframes.find((t) => !t.disabled)?.uid;
  }

  $: availableScenarios = currentTimeframe ? options.filter((s) => s.endYear === currentTimeframe) : options;
  $: chartScenarios = options.filter((s) => s.endYear === currentTimeframe);

  $: renderedScenario = options.find((s) => s.isHighlighted && s.endYear === currentTimeframe);

  // The built-in gate names the selection behind the default list, so it applies
  // only when the caller did not bring a list (and a gate) of its own.
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

  $: gate = disabled ?? (owned ? undefined : $DISABLED);
</script>

<SelectionModal
  label="Scenario"
  {buttonLabel}
  colors={hasScenarioSelected ? $CURRENT_SCENARIOS.map((s) => s.color) : undefined}
  {labelClass}
  {buttonClass}
  warning={!owned && !$IS_EMPTY_INDICATOR && hasScenarioSelected && !$IS_COMBINATION_AVAILABLE_SCENARIO
    ? `No data for ${multipleScenariosSelected ? 'these scenarios' : 'this scenario'} here — pick another`
    : undefined}
  placeholder={!hasScenarioSelected ? 'Select one or more scenarios' : undefined}
  disabled={gate}
  panelClass="max-w-4xl"
  {wrapperClass}
>
  <SelectionPanel>
    <svelte:fragment slot="header">
      <div class="flex items-center justify-between">
        <div>
          <span class="block text-xs uppercase tracking-widest text-theme-weaker mb-2">Pick a timeframe</span>
          <PillGroup bind:currentUid={currentTimeframe} options={timeframes} disabledMessage="No scenarios available for this indicator in this timeframe" />
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
          <ScenarioList highlightedScenarioUid={renderedScenario?.uid} bind:hoveredScenarioUid scenarios={availableScenarios} currentFilterUid={currentTimeframe} {multiple} />
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
