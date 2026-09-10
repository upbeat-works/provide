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
    PERCENTILE_SCENARIO_AVAILABILITY_REQUEST,
    SCENARIO_DETAILS_REQUEST,
    RUNTIME_CATALOG_SELECTION,
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
  import { catalogFlow } from '$stores/catalog-flow.js';
  import { ownedScenarioControlView, scenarioControlView, scenarioDetailLoadKey } from '$stores/catalog-adapters.js';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';

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

  $: buttonLabel = selectedScenarioLabel($CURRENT_SCENARIOS);

  function selectedScenarioLabel(selected) {
    if (!selected.length) return undefined;
    if (selected.length > 1) return `${selected.length} scenarios selected`;
    return selected[0].label;
  }

  function unavailableScenarioWarning() {
    if (owned || $IS_EMPTY_INDICATOR || !hasScenarioSelected || $IS_COMBINATION_AVAILABLE_SCENARIO) return undefined;
    if (multipleScenariosSelected) return 'No data for these scenarios here — pick another';
    return 'No data for this scenario here — pick another';
  }

  // Whether the caller brought its own list — and with it, its own availability.
  $: owned = Boolean(scenarios);
  $: source = scenarios ?? $AVAILABLE_SCENARIOS;
  $: runtimeRequestView = scenarioControlView({
    request: $PERCENTILE_SCENARIO_AVAILABILITY_REQUEST,
    items: source,
  });
  $: ownedRequestView = ownedScenarioControlView(source);
  $: requestView = owned ? ownedRequestView : runtimeRequestView;

  $: timeframes = owned
    ? extractEndYearFromScenarios(
        source,
        source.filter((s) => !s.disabled)
      )
    : $AVAILABLE_TIMEFRAMES;

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

  // Availability may land after mount, so choose a timeframe once options exist.
  $: if (currentTimeframe === undefined && timeframes.length) {
    const current = options.find((s) => ($CURRENT_SCENARIOS_UID ?? []).includes(s.uid));
    currentTimeframe = current?.endYear ?? timeframes.find((t) => !t.disabled)?.uid;
  }

  $: availableScenarios = currentTimeframe ? options.filter((s) => s.endYear === currentTimeframe) : options;
  $: chartScenarios = options.filter((s) => s.endYear === currentTimeframe);

  $: renderedScenario = requestView.status === 'ready' ? options.find((s) => s.isHighlighted && s.endYear === currentTimeframe) : undefined;
  let loadedScenarioKey;
  $: renderedScenarioKey = scenarioDetailLoadKey({ scenarioId: renderedScenario?.uid, indicator: $RUNTIME_CATALOG_SELECTION.indicator });
  $: loadRenderedScenario(renderedScenarioKey, renderedScenario?.uid);
  $: detailIsLoading = loadedScenarioKey === renderedScenarioKey && $SCENARIO_DETAILS_REQUEST.status === 'loading';
  $: detailHasFailed = loadedScenarioKey === renderedScenarioKey && $SCENARIO_DETAILS_REQUEST.status === 'failure';

  function loadRenderedScenario(key, id) {
    if (!key) return;
    if (key === loadedScenarioKey) return;
    loadedScenarioKey = key;
    void catalogFlow.loadScenarioDetails(id);
  }

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
  warning={unavailableScenarioWarning()}
  placeholder={!hasScenarioSelected ? 'Select one or more scenarios' : undefined}
  disabled={gate}
  panelClass="max-w-4xl"
  {wrapperClass}
>
  <SelectionPanel>
    <svelte:fragment slot="header">
      {#if requestView.status === 'loading'}
        <p class="text-sm" role="status">Loading scenarios…</p>
      {:else if requestView.status === 'failure'}
        <div role="alert">
          <p>Scenarios could not be loaded.</p>
          <Button class="mt-3" variant="secondary" on:click={() => catalogFlow.retryPercentileAvailability()}>Retry scenarios</Button>
        </div>
      {:else if requestView.status === 'empty'}
        <p class="text-sm text-text-weaker" role="status">No scenarios are available.</p>
      {:else}
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
      {/if}
    </svelte:fragment>
    <svelte:fragment slot="sidebar">
      {#if requestView.status === 'ready'}
        {#key currentTimeframe}
          <fieldset class="flex flex-col min-w-min py-2">
            <ScenarioList highlightedScenarioUid={renderedScenario?.uid} bind:hoveredScenarioUid scenarios={availableScenarios} currentFilterUid={currentTimeframe} {multiple} />
          </fieldset>
        {/key}
      {/if}
    </svelte:fragment>
    <svelte:fragment slot="content">
      <div class="p-6 w-full">
        {#if renderedScenario}
          <div aria-live="polite" aria-busy={detailIsLoading}>
            {#if detailIsLoading}
              <LoadingPlaceholder />
            {:else if detailHasFailed}
              <div role="alert">
                <p>Scenario details could not be loaded.</p>
                <Button class="mt-3" variant="secondary" on:click={() => catalogFlow.loadScenarioDetails(renderedScenario.uid)}>Retry details</Button>
              </div>
            {:else}
              <ScenarioDetails scenario={renderedScenario} scenarios={chartScenarios} currentFilterUid={currentTimeframe} />
            {/if}
          </div>
        {:else}
          <div class="p-4 flex items-center rounded text-contour-weak justify-center min-h-[60vh]">Hover over a scenario to view details</div>
        {/if}
      </div>
    </svelte:fragment>
  </SelectionPanel>
</SelectionModal>
