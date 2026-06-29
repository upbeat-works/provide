<script>
  import {
    CURRENT_INDICATOR,
    CURRENT_GEOGRAPHY,
    TEMPLATE_PROPS,
    CURRENT_INDICATOR_OPTION_VALUES,
    CURRENT_SCENARIOS_UID,
    IS_COMBINATION_AVAILABLE,
    DOWNLOAD_URL_PARAMS,
    GRAPH_URL_PARAMS,
  } from '$stores/state.js';
  import { END_IMPACT_TIME, KEY_MODEL, KEY_SOURCE, URL_PATH_GEOGRAPHY, URL_PATH_INDICATOR, URL_PATH_SCENARIOS } from '$config';
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';
  import { writable } from 'svelte/store';
  import { fetchData } from '$lib/api/api';
  import { formatValue } from '$lib/utils/formatting';
  import ChartFrame from '$lib/components/charts/ChartFrame/ChartFrame.svelte';
  import ImpactTimeChart from './ImpactTimeChart.svelte';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import { scaleThreshold } from 'd3-scale';
  import { range } from 'd3-array';

  let IMPACT_TIME_DATA = writable([]);

  export let tagline;

  $: $IS_COMBINATION_AVAILABLE &&
    fetchData(IMPACT_TIME_DATA, {
      // Convention-driven ixmp4 adapter (not the legacy API). It resolves the
      // variables and bundles the GMT band into the response. The adapter reads
      // repeated `scenarios=` params, so serialise arrays that way.
      base: import.meta.env.VITE_API_URL,
      arrayFormat: 'repeat',
      endpoint: END_IMPACT_TIME,
      params: {
        [URL_PATH_GEOGRAPHY]: $CURRENT_GEOGRAPHY.uid,
        [URL_PATH_INDICATOR]: $CURRENT_INDICATOR.uid,
        [URL_PATH_SCENARIOS]: $CURRENT_SCENARIOS_UID,
        instance: $CURRENT_INDICATOR.instance,
        ...$CURRENT_INDICATOR_OPTION_VALUES,
      },
    });

  // This is used for the coloring of the line according to the GMT
  const colorMarkers = [-Infinity, 1.5, 2, 2.5, Infinity];
  const colorSteps = scaleThreshold()
    .domain(colorMarkers)
    .range(range(0, 1, 1 / colorMarkers.length));

  $: process = ({ impactTimeData }, { scenarios, urlParams }) => {
    // Scenarios are coming from TEMPLATE_PROPS
    const MODEL = KEY_MODEL;
    const SOURCE = KEY_SOURCE;
    const { yearStart, yearStep, data, gmt: gmtByScenario = {}, unit, formats, description, title, [MODEL]: model, [SOURCE]: source, parameters } = impactTimeData.data;
    const impactTime = scenarios
      // A selected scenario may have no data for this indicator in the instance.
      .filter((scenario) => data[scenario.uid])
      .map((scenario) => {
        const scenarioData = data[scenario.uid]; // Data is coming from the impact time endpoint
        // GMT now arrives bundled in the response as a [min, median, max] band
        // per year, aligned with yearStart/yearStep (replaces curated scenario.gmt).
        const gmtBand = gmtByScenario[scenario.uid] ?? [];

        return {
          ...scenario,
          yearStart,
          yearStep,
          parameters,
          model,
          source,
          description,
          title,
          values: scenarioData.map((values, i) => {
            const year = yearStart + yearStep * i;
            // median (50th percentile) = the warming level; may be absent when
            // GMT has no data for this region/year — leave it uncoloured then.
            const gmtValue = gmtBand[i]?.[1];
            const hasGmt = Number.isFinite(gmtValue);
            const gmt = hasGmt ? formatValue(gmtValue, 'degrees-warming') : undefined;
            const wlvl = hasGmt ? parseFloat(gmt) : undefined;
            const step = hasGmt ? colorSteps(wlvl) : undefined;
            // This values are not always in the correct order of min, average (?), max.
            // https://stackoverflow.com/a/7000895/2314684
            const [min, value, max] = values.sort((a, b) => a - b);
            return {
              gmt,
              wlvl,
              step,
              min,
              value,
              max,
              year,
            };
          }),
        };
      });

    const hasSingleScenario = impactTimeData.length === 1;
    // None of the selected scenarios had data for this combination.
    const first = impactTime[0] ?? {};
    const chartInfo = [
      { label: 'Model', value: first.model },
      { label: 'Source', value: first.source },
      {
        label: 'Time resolution',
        value: first.yearStep ? `${first.yearStep} years` : undefined,
      },
    ];

    const dataDownloadOptions = [
      {
        uid: 'scenario',
        label: 'Scenario',
        options: scenarios,
      },
      {
        uid: 'format',
        label: 'Format',
        options: (formats?.length ? formats : ['csv']).map((uid) => ({
          label: uid,
          uid,
        })),
      },
    ];

    const graphDownloadParams = {
      ...urlParams,
      scenarios: scenarios.map((d) => d.uid),
    };
    return {
      impactTime,
      title: first.title,
      description: first.description,
      // Natural-language unit from the ixmp4 data (response), not curation. The
      // string is both the id and its display label (e.g. "°C").
      unit: unit ? { uid: unit, label: unit } : undefined,
      hasSingleScenario,
      chartInfo,
      dataDownloadOptions,
      dataDownloadParams: urlParams,
      graphDownloadParams,
    };
  };
</script>

{#if $IS_COMBINATION_AVAILABLE}
  <LoadingWrapper
    {process}
    let:asyncProps
    let:props
    asyncProps={{
      impactTimeData: $IMPACT_TIME_DATA,
    }}
    props={{
      ...$TEMPLATE_PROPS,
      graphParams: $GRAPH_URL_PARAMS,
      urlParams: $DOWNLOAD_URL_PARAMS,
    }}
  >
    <ChartFrame
      title={asyncProps.title}
      {tagline}
      description={asyncProps.description}
      dataDownloadParams={asyncProps.dataDownloadParams}
      dataDownloadOptions={asyncProps.dataDownloadOptions}
      graphDownloadParams={asyncProps.graphDownloadParams}
      chartUid={END_IMPACT_TIME}
      chartInfo={asyncProps.chartInfo}
      templateProps={props}
    >
      <ImpactTimeChart data={asyncProps.impactTime} unit={asyncProps.unit ?? props.indicator.unit} indicatorLabel={props.indicatorLabel} steps={colorSteps} />
    </ChartFrame>
    <LoadingPlaceholder slot="placeholder" />
  </LoadingWrapper>
{/if}
