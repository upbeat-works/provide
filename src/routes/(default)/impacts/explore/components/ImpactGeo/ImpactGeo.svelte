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
    URL_PATH_INDICATOR,
    IMPACT_GEO_DISPLAY_OPTIONS,
    END_GEO_SHAPE,
    END_IMPACT_GEO,
    URL_PATH_GEOGRAPHY_TYPE,
    URL_PATH_GEOGRAPHY,
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
  import { buildImpactGeoRequestConfigs, resolveImpactGeoYear } from './impact-geo-state.js';

  export let tagline;
  export let year = resolveImpactGeoYear({
    currentYear: undefined,
    availableYears: [],
    defaultYear: DEFAULT_IMPACT_GEO_YEAR,
  });
  export let displayOption = IMPACT_GEO_KEY_SIDE_BY_SIDE;
  export let showSatellite = false;
  export let showSatelliteOption = true;

  let isProcessing = false;

  let IMPACT_GEO_DATA = writable([]);
  let GEO_SHAPE_DATA = writable({});
  const impactGeoApiBase = import.meta.env.VITE_IMPACT_GEO_API_URL || import.meta.env.VITE_DATA_API_URL;

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
  $: if (yearOptions.length && !yearOptions.includes(year)) {
    year = resolveImpactGeoYear({
      currentYear: year,
      availableYears: yearOptions,
      defaultYear: DEFAULT_IMPACT_GEO_YEAR,
    });
  }

  // GeoServer grid requests use convention-native ids. The outline and legacy
  // download endpoint still require their legacy equivalents.
  $: legacyGeography = toLegacyGeoId($CURRENT_GEOGRAPHY);
  $: legacyIndicator = $CURRENT_INDICATOR?.legacyUid;
  $: legacyOptions = toLegacyParameterValues($CURRENT_INDICATOR_OPTION_VALUES);
  $: mapScenarios = $CURRENT_SCENARIOS;
  $: legacyScenarioPairs = mapScenarios
    .map((scenario) => ({ scenario, legacyUid: toLegacyScenarioUid(scenario.uid) }))
    .filter(({ legacyUid }) => legacyUid);
  $: hasMapContext = Boolean(legacyGeography && $CURRENT_INDICATOR?.uid && mapScenarios.length);

  // The legacy-space twin of DOWNLOAD_URL_PARAMS, for the requests and the data
  // download that still go to the legacy API.
  $: legacyUrlParams = {
    [URL_PATH_GEOGRAPHY]: legacyGeography,
    [URL_PATH_GEOGRAPHY_TYPE]: $CURRENT_GEOGRAPHY?.geographyType,
    [URL_PATH_INDICATOR]: legacyIndicator,
    ...legacyOptions,
  };

  $: if ($IS_COMBINATION_AVAILABLE && hasMapContext) {
    fetchData(
      IMPACT_GEO_DATA,
      buildImpactGeoRequestConfigs({
        base: impactGeoApiBase,
        endpoint: END_IMPACT_GEO,
        selection: $DOWNLOAD_URL_PARAMS,
        scenarios: mapScenarios,
        year,
      })
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

  $: process = ({ data, shape }, { scenarios, legacyScenarioPairs, indicator, urlParams, legacyUrlParams, geography, legacyGeography: geoId }) => {
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
        options: legacyScenarioPairs.map(({ scenario: { label }, legacyUid }) => ({ uid: legacyUid, label })),
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

{#if $IS_COMBINATION_AVAILABLE && hasMapContext}
  <LoadingWrapper
    let:asyncProps
    let:props
    asyncProps={{ data: $IMPACT_GEO_DATA, shape: $GEO_SHAPE_DATA }}
    props={{
      ...$TEMPLATE_PROPS,
      scenarios: mapScenarios,
      legacyScenarioPairs,
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
      No map outline is available for {$CURRENT_GEOGRAPHY?.label ?? 'this geography'}. The other charts on this page are unaffected.
    </span>
  </Message>
{/if}
