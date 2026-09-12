<script>
  import UnavoidableRiskChart from './UnavoidableRiskChart/UnavoidableRiskChart.svelte';
  import ColorLegend from '$lib/components/charts/legends/ColorLegend.svelte';
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { min } from 'd3-array';
  import { formatValue, findDecimalsForDistinctValues } from '$lib/utils/formatting';
  import { URL_PATH_SCENARIOS, END_UN_AVOIDABLE_RISK, UNAVOIDABLE_UID, KEY_MODEL, KEY_SOURCE, KEY_SCENARIO_ENDYEAR } from '$src/config.js';
  import { sortBy, reverse, find, without, isObject, isString, has } from 'lodash-es';
  import { fetchData } from '$lib/api/api';
  import ChartFrame from '$lib/components/charts/ChartFrame/ChartFrame.svelte';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import { writable } from 'svelte/store';
  import { scenariosForTimeframe } from '$stores/catalog-adapters.js';
  import Button from '$lib/components/ui/Button.svelte';
  import Message from '$lib/components/ui/Message.svelte';

  const STORE = writable({});
  export let threshold = undefined;

  export let tagline = undefined;
  export let chartContext;
  export let retryAvailability = undefined;

  $: warmingView = chartContext.view;
  $: currentSelectedScenarios = chartContext.scenarios;
  $: allScenarios = chartContext.allScenarios;
  $: warmingRequest = warmingView.status === 'ready' ? {
    geography: chartContext.geography.uid,
    indicator: chartContext.indicator.uid,
    instance: chartContext.indicator.instance,
    scenarios: allScenarios.map(({ uid }) => uid),
    ...chartContext.parameters,
  } : undefined;

  $: requestConfig = warmingRequest ? {
      // Convention-driven ixmp4 adapter (not the legacy API). It resolves one
      // exceedance series per warming threshold. The adapter reads repeated
      // `scenarios=` params, so serialise arrays that way.
      base: import.meta.env.VITE_API_URL,
      arrayFormat: 'repeat',
      endpoint: END_UN_AVOIDABLE_RISK,
      params: warmingRequest,
    } : undefined;
  $: if (requestConfig) fetchData(STORE, requestConfig);

  function retryWarmingRequest() {
    fetchData(STORE, requestConfig);
  }

  $: process = ({ data }, { selectedScenarios, urlParams, allScenarios, indicator = {}, geography, unitUid }) => {
    const { instance } = indicator;
    // This creates the list of thresholds
    const decimals = findDecimalsForDistinctValues(data.thresholds, unitUid);

    const thresholds = data.thresholds.map((value) => ({
      label: `${value < 0 ? '−' : ''}${formatValue(Math.abs(value), unitUid, { decimals })}`,
      value,
    }));

    const hasThresholds = data.thresholds.length;
    let thresholdIndex = data.thresholds.indexOf(threshold); // Get the index of the currently selected threshold

    // If the currently selected threshold does not exist is the list of possible thresholds
    if (thresholdIndex === -1) {
      // If no thresholds are present, we use 0
      // If thresholds are present, we try to use the default threshold. If this is not present, we fallback to 0
      thresholdIndex = hasThresholds ? Math.max(0, data.thresholds.indexOf(data.defaultThreshold)) : 0;
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
      allScenarios: allScenarios.map((d) => d.uid),
      timeframe,
      unit: unitUid,
      indicatorLabel: indicator.label,
      geographyLabel: geography.label,
    };

    const chartInfo = [
      { label: 'Model', value: data.model },
      { label: 'Source', value: data.source },
    ];

    // The endpoint might not always return data for all scenarios
    const includedScenarios = Object.keys(data.data);
    const legendItems = [...selectedScenarios.filter(({ uid }) => includedScenarios.includes(uid))];

    // Checking if there are more scenarios than the selected ones included
    const hasOtherScenarios = without(includedScenarios, ...selectedScenarios.map(({ uid }) => uid)).length;
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
    retry={retryWarmingRequest}
    let:props
    let:isLoading
    let:asyncProps
    {process}
    asyncProps={$STORE}
    props={{
      ...chartContext,
      allScenarios,
      selectedScenarios: currentSelectedScenarios,
      threshold,
      urlParams: chartContext.urlParams,
      unitUid: chartContext.unitUid,
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
      staticMode={chartContext.static}
      {isLoading}
    >
      <div class="0" slot="controls">
        {#if asyncProps.thresholds.length > 1}
          <Select label="Impact level" options={asyncProps.thresholds} bind:value={threshold} staticMode={chartContext.static} />
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
      <Button variant="secondary" on:click={retryAvailability}>Retry indicators</Button>
    </Message>
  {:else}
    <Message headline="Warming availability could not be loaded">
      <Button variant="secondary" on:click={retryAvailability}>Retry warming data</Button>
    </Message>
  {/if}
{/if}
