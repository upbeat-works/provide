<script>
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';

  import {
    CURRENT_GEOGRAPHY,
    CURRENT_INDICATOR,
    CURRENT_INDICATOR_OPTION_VALUES,
    CURRENT_SCENARIOS,
    AVAILABLE_IMPACT_GEO_YEARS,
    DEFAULT_AVAILABLE_IMPACT_GEO_YEAR,
    TEMPLATE_PROPS,
    DOWNLOAD_URL_PARAMS,
    IS_COMBINATION_AVAILABLE,
  } from '$src/stores/state';
  import {
    URL_PATH_SCENARIO,
    URL_PATH_YEAR,
    URL_PATH_INDICATOR,
    IMPACT_GEO_DISPLAY_OPTIONS,
    END_GEO_SHAPE,
    END_IMPACT_GEO,
    URL_PATH_GEOGRAPHY_TYPE,
    URL_PATH_GEOGRAPHY,
    URL_PATH_SCENARIOS,
    IMPACT_GEO_KEY_DIFFERENCE,
    IMPACT_GEO_KEY_SIDE_BY_SIDE,
    DEFAULT_IMPACT_GEO_YEAR,
    GEOGRAPHY_TYPE_CITY,
    COLOR_SCALES,
  } from '$config';
  import { writable } from 'svelte/store';
  import { fetchData } from '$lib/api/api';

  import ChartFrame from '$lib/components/charts/ChartFrame/ChartFrame.svelte';

  import Controls from './Controls.svelte';
  import Maps from './Maps.svelte';
  import { toLegacyGeoId, toLegacyScenarioUid, toLegacyParameterValues } from '$lib/catalog/translate.js';
  import Message from '$lib/components/ui/Message.svelte';
  import { getColorScale, coordinatesToRectGrid, calculateDifference, coordinatesToContours } from '$utils/geo.js';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import { formatValue } from '$lib/utils/formatting';
  import { isObject, isString, has } from 'lodash-es';

  export let tagline;
  export let year = undefined;
  export let displayOption = IMPACT_GEO_KEY_SIDE_BY_SIDE;
  export let showSatellite = false;
  export let showSatelliteOption = true;

  let isProcessing = false;

  let IMPACT_GEO_DATA = writable([]);
  let GEO_SHAPE_DATA = writable({});

  // `AVAILABLE_IMPACT_GEO_YEARS` reads `selectableYears` off the indicator, which
  // was legacy curation the convention catalog doesn't carry — so it is empty and
  // the Year control would render with no options. The response reports the years
  // its grid holds, but the response is keyed on the year, so naively feeding them
  // back closes a year → request → response → year loop that re-enters the fetch
  // and keeps restarting the map masking worker.
  //
  // Latching breaks it: adopt a year list only when a non-empty, genuinely
  // different one arrives, and never clear it while a request is in flight. The
  // reads live inside the function so they aren't dependencies of the reactive
  // statement, and the no-op early returns mean an unchanged response invalidates
  // nothing.
  let latchedYears = [];
  let latchedYearsKey = '';
  function latchYears(store) {
    const years = store?.[0]?.data?.selectableYears;
    if (!years?.length) return;
    const key = years.join(',');
    if (key === latchedYearsKey) return;
    latchedYearsKey = key;
    latchedYears = years.map(Number).filter(Number.isFinite);
  }
  $: latchYears($IMPACT_GEO_DATA);

  $: yearOptions = $AVAILABLE_IMPACT_GEO_YEARS.length ? $AVAILABLE_IMPACT_GEO_YEARS : latchedYears;
  $: defaultYear = yearOptions.includes(DEFAULT_IMPACT_GEO_YEAR) ? DEFAULT_IMPACT_GEO_YEAR : yearOptions[0];

  // Only reset once options exist — clearing `year` mid-request would change the
  // request that produces the options.
  $: if (yearOptions.length && !yearOptions.includes(year)) {
    year = defaultYear;
  }

  // The gridded maps and their outlines are the one part of explore still served
  // by the legacy Climate Analytics API (ixmp4 carries region-aggregated
  // timeseries, not grids), so every id crossing into them has to be translated
  // out of the convention id space: geographies bridge on geoId, indicators on
  // the curated legacyUid, scenarios and parameter values on the tables in
  // `$lib/catalog/translate.js`.
  $: legacyGeography = toLegacyGeoId($CURRENT_GEOGRAPHY);
  $: legacyIndicator = $CURRENT_INDICATOR?.legacyUid;
  $: legacyOptions = toLegacyParameterValues($CURRENT_INDICATOR_OPTION_VALUES);
  // Keep each selected scenario paired with its legacy uid rather than mapping to
  // a bare list: one request goes out per pair and `process` reads the responses
  // back positionally, so dropping an unmappable scenario silently would shift
  // every later map onto the wrong scenario's colour and label.
  $: scenarioPairs = $CURRENT_SCENARIOS.map((scenario) => ({ scenario, legacyUid: toLegacyScenarioUid(scenario.uid) })).filter(({ legacyUid }) => legacyUid);
  $: legacyScenarios = scenarioPairs.map(({ legacyUid }) => legacyUid);
  // Only a selection that translates whole can be requested. An indicator with
  // no legacy twin (most of the convention catalog) or a scenario that never
  // existed there would otherwise fire a request the legacy API answers with a
  // 520, so the section reports itself unavailable instead.
  $: hasLegacyEquivalent = Boolean(legacyGeography && legacyIndicator && legacyScenarios.length);

  // The legacy-space twin of DOWNLOAD_URL_PARAMS, for the requests and the data
  // download that still go to the legacy API.
  $: legacyUrlParams = {
    [URL_PATH_GEOGRAPHY]: legacyGeography,
    [URL_PATH_GEOGRAPHY_TYPE]: $CURRENT_GEOGRAPHY?.geographyType,
    [URL_PATH_INDICATOR]: legacyIndicator,
    ...legacyOptions,
  };

  $: if ($IS_COMBINATION_AVAILABLE && hasLegacyEquivalent) {
    fetchData(
      IMPACT_GEO_DATA,
      legacyScenarios.map((scenario) => ({
        endpoint: END_IMPACT_GEO,
        params: {
          ...legacyUrlParams,
          [URL_PATH_SCENARIO]: scenario,
          [URL_PATH_SCENARIOS]: legacyScenarios,
          [URL_PATH_YEAR]: year,
        },
      }))
    );

    fetchData(GEO_SHAPE_DATA, {
      endpoint: END_GEO_SHAPE,
      params: {
        // geoId, not the convention uid — geo-shape is keyed on the legacy id
        // (`POL`, `accra`), and a convention name 520s.
        [URL_PATH_GEOGRAPHY]: legacyGeography,
      },
    });
  }

  // `scenarios` here is the mapped subset, positionally aligned with the
  // responses — not the raw selection (see scenarioPairs). `urlParams` is the
  // legacy-shaped selection, because this chart's data download hits the legacy
  // API too.
  $: process = ({ data, shape }, { scenarios, legacyScenarios, indicator, urlParams, legacyUrlParams, geography, legacyGeography: geoId }) => {
    isProcessing = true;
    const showDifference = data.length === 2 && displayOption === IMPACT_GEO_KEY_DIFFERENCE;
    const isMultipMap = data.length > 1 && !showDifference;

    if (geography.geographyType !== GEOGRAPHY_TYPE_CITY) {
      showSatelliteOption = false;
      showSatellite = false;
    } else {
      showSatelliteOption = true;
    }

    // The data that is actually being rendered
    const renderedData = showDifference
      ? [calculateDifference(data)]
      : data.map((d, i) => ({
          ...(isMultipMap ? scenarios[i] : {}),
          ...d.data,
        }));

    const colorScale = getColorScale(
      renderedData.map((d) => d.data),
      COLOR_SCALES[indicator.colorScale],
      indicator.direction
    );

    const geoData = renderedData.map(({ data, coordinatesOrigin: origin, resolution, ...d }) => {
      const cellCount = data.length * data[0].length;
      const geoData =
        cellCount > 10000
          ? coordinatesToContours(data, { resolution, origin, colorScale })
          : coordinatesToRectGrid(data, {
              origin,
              resolution,
              colorScale,
            });
      return {
        ...d,
        data: geoData,
      };
    });

    const { model, source, resolution } = data[0].data;
    const formattedResolution = formatValue(resolution, 'degree', {
      addSuffix: false,
    });
    const chartInfo = [
      { label: 'Model', value: model },
      { label: 'Source', value: source },
      {
        label: 'Spatial resolution',
        value: `${formattedResolution} × ${formattedResolution}°`,
      },
    ];

    const dataDownloadOptions = [
      {
        uid: 'scenario',
        // The download is a legacy-API request, so the value has to be the
        // legacy scenario uid — only the label stays the convention one.
        label: 'Scenario',
        options: scenarios.map(({ label }, i) => ({ uid: legacyScenarios[i], label })),
      },
      {
        uid: 'resolution',
        label: 'Resolution',
        options: data[0].data.resolutions.map((uid) => ({ label: uid, uid })),
      },
      {
        uid: 'format',
        label: 'Format',
        options: data[0].data.formats.map((uid) => ({ label: uid, uid })),
      },
    ];

    // Data download → the legacy API, so legacy ids throughout.
    const dataDownloadParams = {
      ...legacyUrlParams,
      displayOption,
      year,
    };

    // Graph download → an `/embed/…` link back into this app, which reads the
    // convention id space. Deliberately NOT built from dataDownloadParams.
    const graphDownloadParams = {
      ...urlParams,
      displayOption,
      year,
      scenarios: scenarios.map((d) => d.uid),
    };

    // geo-shape features are tagged with the LEGACY geography id (`POL`), so the
    // outline is picked by geoId — the convention uid never matches.
    const geoShape = shape.data.data.features.find((feature) => feature.properties.uid === geoId) ?? shape.data.data.features[0];

    // // In some cases, the API provides descriptions for each threshold
    const rawDesciption = data[0].data.description; // The descriptions for all scenarios are the same.
    let description;
    if (isObject(rawDesciption) && has(rawDesciption, displayOption)) {
      description = rawDesciption[displayOption];
    } else if (isString(rawDesciption)) {
      description = rawDesciption;
    }

    return {
      showDifference,
      geoData,
      geoShape: geoShape, // shape.data.data.features[0],
      title: data[0].data.title,
      description,
      colorScale,
      chartInfo,
      dataDownloadParams,
      dataDownloadOptions,
      graphDownloadParams,
    };
  };
</script>

{#if $IS_COMBINATION_AVAILABLE && hasLegacyEquivalent}
  <LoadingWrapper
    let:asyncProps
    let:props
    asyncProps={{ data: $IMPACT_GEO_DATA, shape: $GEO_SHAPE_DATA }}
    props={{
      ...$TEMPLATE_PROPS,
      // The mapped subset, aligned with the responses — overrides the full
      // selection TEMPLATE_PROPS carries.
      scenarios: scenarioPairs.map(({ scenario }) => scenario),
      legacyScenarios,
      year,
      urlParams: $DOWNLOAD_URL_PARAMS,
      legacyUrlParams,
      legacyGeography,
    }}
    {process}
    let:isLoading
  >
    <ChartFrame
      title={asyncProps.title}
      {tagline}
      description={asyncProps.description}
      dataDownloadOptions={asyncProps.dataDownloadOptions}
      dataDownloadParams={asyncProps.dataDownloadParams}
      graphDownloadParams={asyncProps.graphDownloadParams}
      graphDownloadSettings={{
        formats: ['png'],
        processingIntensity: asyncProps.geoData.length * 4,
      }}
      chartUid={END_IMPACT_GEO}
      templateProps={{ ...props, showDifference: asyncProps.showDifference }}
      chartInfo={asyncProps.chartInfo}
      {isLoading}
      {isProcessing}
    >
      <svelte:fragment slot="controls">
        <Controls
          scenarios={props.scenarios}
          {yearOptions}
          displayOptions={IMPACT_GEO_DISPLAY_OPTIONS}
          {showSatelliteOption}
          bind:showSatellite
          bind:displayOption
          bind:year
        />
      </svelte:fragment>
      <Maps bind:isProcessing unit={props.indicator.unit} geoData={asyncProps.geoData} geoShape={asyncProps.geoShape} colorScale={asyncProps.colorScale} {showSatellite} />
    </ChartFrame>
    <LoadingPlaceholder slot="placeholder" />
  </LoadingWrapper>
{:else if $IS_COMBINATION_AVAILABLE}
  <Message headline="Maps are not available for this selection">
    <span class="text-contour-weaker">
      The gridded maps come from the legacy dataset, which doesn’t cover {$CURRENT_INDICATOR?.label ?? 'this indicator'}
      {#if legacyIndicator && !legacyScenarios.length}for the selected scenarios{/if}. The other charts on this page are unaffected.
    </span>
  </Message>
{/if}
