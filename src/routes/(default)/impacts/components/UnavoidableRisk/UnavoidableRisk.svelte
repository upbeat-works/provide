<script>
  import {
    CURRENT_INDICATOR,
    CURRENT_INDICATOR_UNIT_UID,
    CURRENT_GEOGRAPHY,
    CURRENT_INDICATOR_OPTION_VALUES,
    TEMPLATE_PROPS,
    CURRENT_SCENARIOS,
    SELECTABLE_WARMING_SCENARIOS,
    DOWNLOAD_URL_PARAMS,
    ACTIVE_INDICATOR_SCOPE_CONTEXT,
    WARMING_CHART_VIEW,
  } from '$stores/state.js';
  import UnavoidableRiskChart from './UnavoidableRiskChart/UnavoidableRiskChart.svelte';
  import ColorLegend from '$lib/components/charts/legends/ColorLegend.svelte';
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { min } from 'd3-array';
  import { formatValue, findDecimalsForDistinctValues } from '$lib/utils/formatting';
  import { URL_PATH_SCENARIOS, END_UN_AVOIDABLE_RISK, UNAVOIDABLE_UID, KEY_MODEL, KEY_SOURCE, KEY_SCENARIO_ENDYEAR } from '$src/config.js';
  import { sortBy, reverse, find, without, isObject, isString, has } from 'lodash-es';
  import { fetchData } from '$lib/api/api';
  import { withScenarioTimeframe } from '$lib/utils/utils.js';
  import ChartFrame from '$lib/components/charts/ChartFrame/ChartFrame.svelte';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import { writable } from 'svelte/store';
  import { retryWarmingChartRequest, scenariosForTimeframe, warmingChartRequest } from '$stores/catalog-adapters.js';
  import { catalogFlow } from '$stores/catalog-flow.js';
  import Button from '$lib/components/ui/Button.svelte';
  import Message from '$lib/components/ui/Message.svelte';

  const STORE = writable({});
  let threshold; // This holds the selected threshold

  export let tagline;

  /** @type {Array} A list of currently selected scenarios.
  This is nesecssary because of the two modes: The user can select scenarios in Future Impacts.
  In this case we use the list given by the state with the selected scenarios.
  In the Avoiding Impacts mode, we display the default list of scenarios. */
  export let currentScenarios = [];

  // This checks if the passed list of scenarios is valid. If yes, it uses it, otherwise it falls back to the list in the state.
  // endYear (the timeframe that drives the year filtering below) is data-driven
  // and lives on SELECTABLE_WARMING_SCENARIOS, not on the bare CURRENT_SCENARIOS —
  // graft it on, or timeframe is undefined and every year gets filtered out (blank
  // chart). The scatter plots the warming-level axis, so its scenario universe and
  // timeframes come from the warming-level availability, not the percentile-based
  // selector shared with the impact-time/geo band charts on this page.
  $: currentSelectedScenarios = withScenarioTimeframe(
    (Array.isArray(currentScenarios) && currentScenarios.length ? currentScenarios : $CURRENT_SCENARIOS).map(
      // We just need a small set of attributes
      ({ uid, label, color, [KEY_SCENARIO_ENDYEAR]: timeframe }) => ({ uid, label, color, [KEY_SCENARIO_ENDYEAR]: timeframe })
    ),
    $SELECTABLE_WARMING_SCENARIOS,
    KEY_SCENARIO_ENDYEAR
  );

  $: warmingView = $WARMING_CHART_VIEW;
  $: warmingRequest = warmingChartRequest({
    view: warmingView,
    geography: $CURRENT_GEOGRAPHY?.uid,
    indicator: $CURRENT_INDICATOR ? { id: $CURRENT_INDICATOR.uid, instance: $CURRENT_INDICATOR.instance } : undefined,
    scenarios: $SELECTABLE_WARMING_SCENARIOS,
    parameters: $CURRENT_INDICATOR_OPTION_VALUES,
  });

  $: warmingRequest &&
    fetchData(STORE, {
      // Convention-driven ixmp4 adapter (not the legacy API). It resolves one
      // exceedance series per warming threshold. The adapter reads repeated
      // `scenarios=` params, so serialise arrays that way.
      base: import.meta.env.VITE_API_URL,
      arrayFormat: 'repeat',
      endpoint: END_UN_AVOIDABLE_RISK,
      params: warmingRequest,
    });

  function retryWarmingRequest() {
    retryWarmingChartRequest({ view: warmingView, flow: catalogFlow, indicatorScopeContext: $ACTIVE_INDICATOR_SCOPE_CONTEXT });
  }

  $: process = ({ data }, { selectedScenarios, urlParams, allScenarios, indicator: { instance } = {} }) => {
    // This creates the list of thresholds
    const decimals = findDecimalsForDistinctValues(data.thresholds, $CURRENT_INDICATOR_UNIT_UID);

    const thresholds = data.thresholds.map((value) => ({
      label: `${value < 0 ? '−' : ''}${formatValue(Math.abs(value), $CURRENT_INDICATOR_UNIT_UID, { decimals })}`,
      value,
    }));

    const hasThresholds = data.thresholds.length;
    let thresholdIndex = data.thresholds.indexOf(threshold); // Get the index of the currently selected threshold

    // If the currently selected threshold does not exist is the list of possible thresholds
    if (thresholdIndex === -1) {
      // If no thresholds are present, we use 0
      // If thresholds are present, we try to use the default threshold. If this is not present, we fallback to 0
      thresholdIndex = hasThresholds ? data.thresholds.indexOf(data.defaultThreshold) || 0 : 0;
    }

    // We use the index to find the threshold, but fallback to 0
    threshold = data.thresholds[thresholdIndex] ?? 0;

    // The timeframe is determined by the first selected scenario, because the selected scenarios must have the same timeframe
    const timeframe = selectedScenarios[0][KEY_SCENARIO_ENDYEAR];

    // We filter out unused years
    const validYears = data.years.filter((y) => y <= timeframe);

    // We display all scenarios in this timeframe
    // For this, we merge the selected and all scenarios together
    // This is because the selected scenarios have the assigned colors included
    // That’s why we spread them first in the new array
    const mergedScenarios = scenariosForTimeframe({ selectedScenarios, allScenarios });

    let processedScenarios = Object.entries(data.data)
      .map(([uid, scenarioData]) => {
        // Find the current scenario in the list of valid scenarios
        const scenario = find(mergedScenarios, { uid });
        // If the scenario is not present (probably because the timeframe is different), we skip/remove it
        if (!scenario) return;
        const values = validYears.map((year, yearIndex) => {
          const value = scenarioData[thresholdIndex][yearIndex];
          return {
            year,
            value,
            formattedValue: formatValue(value, 'percent'),
          };
        });
        return {
          ...scenario,
          values,
        };
      })
      .filter(Boolean);

    // The selected scenarios (the ones with a color) should come first. We don’t need a more refined sorting here, as the dots don’t overlay
    processedScenarios = reverse(sortBy(processedScenarios, 'color'));

    const unavoidableValues = validYears.map((year, yearIndex) => {
      const value = min(processedScenarios, (d) => d.values[yearIndex].value);
      return {
        year,
        value,
        formattedValue: formatValue(value, 'percent'),
      };
    });

    unavoidableValues.unshift({
      year: 'Today’s risk',
      value: data.today[thresholdIndex],
      formattedValue: formatValue(data.today[thresholdIndex], 'percent'),
    });

    const xDomain = unavoidableValues.map(({ year }) => year);

    processedScenarios.unshift({
      uid: UNAVOIDABLE_UID,
      label: 'Unavoidable',
      values: unavoidableValues,
    });

    const dataDownloadOptions = [
      {
        uid: 'format',
        label: 'Format',
        options: (data.formats?.length ? data.formats : ['csv']).map((uid) => ({
          label: uid,
          uid,
        })),
      },
    ];

    // The download hits the same adapter endpoint as the chart, so it needs the
    // same request: the instance to pick the ixmp4 platform, and the full
    // scenario set the chart plots. No `threshold` — the adapter always returns
    // every threshold and the CSV carries it as a column.
    const dataDownloadParams = {
      ...urlParams,
      instance,
      [URL_PATH_SCENARIOS]: allScenarios.map((d) => d.uid),
    };
    const graphDownloadParams = {
      ...urlParams,
      threshold,
      scenarios: selectedScenarios.map((d) => d.uid),
    };

    const chartInfo = [
      { label: 'Model', value: data.model },
      { label: 'Source', value: data.source },
    ];

    // The endpoint might not always return data for all scenarios
    const includedScenarios = Object.keys(data.data);
    const legendItems = [...currentSelectedScenarios.filter(({ uid }) => includedScenarios.includes(uid))];

    // Checking if there are more scenarios than the selected ones included
    const hasOtherScenarios = without(includedScenarios, ...currentSelectedScenarios.map(({ uid }) => uid)).length;
    if (hasOtherScenarios) {
      legendItems.push({ label: 'Other scenarios', uid: 'other' });
    }

    // In some cases, the API provides descriptions for each threshold
    let description;
    if (isObject(data.description) && has(data.description, threshold)) {
      description = data.description[threshold];
    } else if (isString(data.description)) {
      description = data.description;
    }

    return {
      ...data,
      thresholds,
      title: data.title,
      description,
      data: processedScenarios,
      // The following two items would be included anyway, but we state them for clarity
      model: data[KEY_MODEL],
      source: data[KEY_SOURCE],
      dataDownloadOptions,
      dataDownloadParams,
      graphDownloadParams,
      chartInfo,
      xDomain,
      legendItems,
    };
  };
</script>

{#if warmingView.status === 'ready'}
  <LoadingWrapper
    let:props
    let:isLoading
    let:asyncProps
    {process}
    asyncProps={$STORE}
    props={{
      ...$TEMPLATE_PROPS,
      allScenarios: $SELECTABLE_WARMING_SCENARIOS,
      selectedScenarios: currentSelectedScenarios,
      threshold,
      urlParams: $DOWNLOAD_URL_PARAMS,
    }}
  >
    <ChartFrame
      {tagline}
      title={asyncProps.title}
      description={asyncProps.description}
      templateProps={props}
      dataDownloadParams={asyncProps.dataDownloadParams}
      dataDownloadOptions={asyncProps.dataDownloadOptions}
      dataDownloadBase={import.meta.env.VITE_API_URL}
      dataDownloadArrayFormat="repeat"
      graphDownloadParams={asyncProps.graphDownloadParams}
      chartUid={END_UN_AVOIDABLE_RISK}
      chartInfo={asyncProps.chartInfo}
      {isLoading}
    >
      <div class="0" slot="controls">
        {#if asyncProps.thresholds.length > 1}
          <Select label="Impact level" options={asyncProps.thresholds} bind:value={threshold} />
        {/if}
      </div>
      <ColorLegend items={asyncProps.legendItems} class="my-4" />
      <figure class="aspect-[2.5]">
        <UnavoidableRiskChart xDomain={asyncProps.xDomain} data={asyncProps.data} currentScenarios={currentSelectedScenarios} />
        <figcaption class="mt-2">
          <span class="text-xs text-contour-weaker">To avoid overlapping scenarios, the vertical and horizontal placement of each dot may not be perfectly correct.</span>
        </figcaption>
      </figure>
    </ChartFrame>
    <LoadingPlaceholder slot="placeholder" />
  </LoadingWrapper>
{:else if warmingView.status === 'loading'}
  <LoadingPlaceholder />
{:else if warmingView.status === 'failure'}
  {#if warmingView.failedRequest === 'indicatorScope'}
    <Message headline="Indicators could not be loaded for this selection">
      <Button variant="secondary" on:click={retryWarmingRequest}>Retry indicators</Button>
    </Message>
  {:else}
    <Message headline="Warming availability could not be loaded">
      <Button variant="secondary" on:click={retryWarmingRequest}>Retry warming data</Button>
    </Message>
  {/if}
{/if}
