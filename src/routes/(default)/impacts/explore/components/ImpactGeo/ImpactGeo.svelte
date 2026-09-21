<script>
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';

  import {
    IMPACT_GEO_DISPLAY_OPTIONS,
    END_GEO_SHAPE,
    END_IMPACT_GEO,
    URL_PATH_GEOGRAPHY,
    IMPACT_GEO_KEY_DIFFERENCE,
    IMPACT_GEO_KEY_SIDE_BY_SIDE,
    DEFAULT_IMPACT_GEO_YEAR,
    GEOGRAPHY_TYPE_CITY,
    COLOR_SCALES,
  } from '$config';
  import { writable } from 'svelte/store';
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { startMapGridLoad } from '$lib/maps/map-grid-loader.js';
  import { fetchData } from '$lib/api/api';
  import { mapGridRequests } from '$lib/catalog/map-request.js';

  import ChartFrame from '$lib/components/charts/ChartFrame/ChartFrame.svelte';

  import Controls from './Controls.svelte';
  import Maps from './Maps.svelte';
  import Message from '$lib/components/ui/Message.svelte';
  import { getColorScale, coordinatesToRectGrid, calculateDifference, coordinatesToContours } from '$utils/geo.js';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import { formatValue } from '$lib/utils/formatting';
  import { isObject, isString, has } from 'lodash-es';
  import Button from '$lib/components/ui/Button.svelte';

  export let tagline = undefined;
  export let year = undefined;
  export let displayOption = IMPACT_GEO_KEY_SIDE_BY_SIDE;
  export let showSatellite = false;
  export let showSatelliteOption = true;
  export let chartContext;
  export let retryAvailability = undefined;

  let isProcessing = false;

  let IMPACT_GEO_DATA = writable([]);
  let GEO_SHAPE_DATA = writable({});

  $: yearOptions = chartContext.availableYears ?? [];
  $: defaultYear = yearOptions.includes(DEFAULT_IMPACT_GEO_YEAR) ? DEFAULT_IMPACT_GEO_YEAR : yearOptions[0];

  $: if (yearOptions.length && !yearOptions.includes(year)) {
    year = defaultYear;
  }

  $: mapView = chartContext.view;
  $: legacyGeography = chartContext.geography?.geoId;
  $: loadingProps = {
    ...chartContext,
    year,
    urlParams: chartContext.urlParams,
    legacyGeography,
  };
  $: impactGeoRequests = mapView.status === 'ready' ? {
    data: mapGridRequests(mapView.selection, year),
    shape: {
      endpoint: END_GEO_SHAPE,
      params: {
        [URL_PATH_GEOGRAPHY]: legacyGeography,
      },
    },
  } : undefined;

  let cancelGridLoad;
  let loadedRequest;
  onDestroy(() => cancelGridLoad?.());

  $: loadMap(impactGeoRequests);

  function loadMap(requests) {
    const requestKey = JSON.stringify(requests);
    if (requestKey === loadedRequest) return;
    loadedRequest = requestKey;
    cancelGridLoad?.();
    if (!browser || !requests) return;
    cancelGridLoad = startMapGridLoad(requests.data, IMPACT_GEO_DATA.set);
    fetchData(GEO_SHAPE_DATA, requests.shape);
  }

  function retryMapRequest() {
    loadedRequest = undefined;
    loadMap(impactGeoRequests);
  }

  $: process = ({ data, shape }, { scenarios, indicator, urlParams, geography, legacyGeography: geoId }) => {
    const showDifference = data.length === 2 && displayOption === IMPACT_GEO_KEY_DIFFERENCE;
    const isMultipMap = data.length > 1 && !showDifference;

    if (geography.geographyType !== GEOGRAPHY_TYPE_CITY) {
      showSatelliteOption = false;
      showSatellite = false;
    } else {
      showSatelliteOption = true;
    }

    const invalidRasterUnit = data.map(({ data: grid }) => grid.unit).filter(Boolean)
      .find((unit) => unit !== indicator.unit?.uid && unit !== indicator.unit?.label);
    let processingError = invalidRasterUnit
      ? `Raster unit ${invalidRasterUnit} does not match ${indicator.unit?.label ?? indicator.unit?.uid}`
      : undefined;
    let renderedData;
    if (showDifference) {
      try {
        renderedData = [calculateDifference(data)];
      } catch (error) {
        processingError = error instanceof Error ? error.message : String(error);
        renderedData = data.map((d, i) => ({ ...scenarios[i], ...d.data }));
      }
    } else {
      renderedData = data.map((d, i) => {
        let scenario = {};
        if (isMultipMap) scenario = scenarios[i];
        return { ...scenario, ...d.data };
      });
    }

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
    ].filter(({ value }) => value !== undefined && value !== '');

    const dataDownloadOptions = [
      {
        uid: 'scenario',
        label: 'Scenario',
        options: scenarios.map(({ uid, label }) => ({ uid, label })),
      },
      {
        uid: 'resolution',
        label: 'Resolution',
        options: [{ uid: 'native', label: `${formattedResolution}°` }],
      },
      {
        uid: 'format',
        label: 'Format',
        options: data[0].data.formats.map((uid) => ({ label: uid, uid })),
      },
    ];

    const { scenarios: _selectionScenarios, ...selectionParams } = mapView.selection;
    const dataDownloadParams = {
      ...selectionParams,
      year,
    };

    const graphDownloadParams = {
      ...urlParams,
      displayOption,
      year,
      showSatellite,
      scenarios: scenarios.map((d) => d.uid),
      geoId,
      geographyType: geography.geographyType,
      geographyLabel: geography.label,
      indicatorLabel: indicator.label,
      unit: indicator.unit?.uid,
      colorScale: indicator.colorScale,
      direction: indicator.direction,
    };

    // geo-shape features are tagged with the LEGACY geography id (`POL`), so the
    // outline is picked by geoId — the convention uid never matches.
    const geoShape = shape.data.data.features.find((feature) => feature.properties.uid === geoId) ?? shape.data.data.features[0];

    const rawDesciption = data[0].data.description;
    let description;
    if (isObject(rawDesciption) && has(rawDesciption, displayOption)) {
      description = rawDesciption[displayOption];
    } else if (isString(rawDesciption)) {
      description = rawDesciption;
    }

    return {
      showDifference,
      geoData,
      geoShape,
      title: data[0].data.title ?? `${indicator.label} map ${year}`,
      description,
      colorScale,
      chartInfo,
      dataDownloadParams,
      dataDownloadOptions,
      graphDownloadParams,
      processingError,
      processingHeadline: showDifference ? 'Map comparison is not available' : 'Map unavailable',
    };
  };
</script>

{#if mapView.status === 'ready'}
  <LoadingWrapper
    retry={retryMapRequest}
    let:asyncProps
    let:props
    asyncProps={{ data: $IMPACT_GEO_DATA, shape: $GEO_SHAPE_DATA }}
    props={loadingProps}
    {process}
    let:isLoading
  >
    <ChartFrame
      title={asyncProps.title}
      {tagline}
      description={asyncProps.description}
      dataDownloadOptions={asyncProps.dataDownloadOptions}
      dataDownloadParams={asyncProps.dataDownloadParams}
      dataDownloadBase={import.meta.env.VITE_API_URL}
      dataDownloadArrayFormat="repeat"
      graphDownloadParams={asyncProps.graphDownloadParams}
      graphDownloadSettings={{
        formats: ['png'],
        processingIntensity: asyncProps.geoData.length * 4,
      }}
      chartUid={END_IMPACT_GEO}
      templateProps={{ ...props, showDifference: asyncProps.showDifference }}
      chartInfo={asyncProps.chartInfo}
      staticMode={chartContext.static}
      {isLoading}
      {isProcessing}
    >
      <svelte:fragment slot="controls">
        <Controls scenarios={props.scenarios} {yearOptions} displayOptions={IMPACT_GEO_DISPLAY_OPTIONS} {showSatelliteOption} staticMode={chartContext.static} bind:showSatellite bind:displayOption bind:year />
      </svelte:fragment>
      {#if asyncProps.processingError}
        <Message headline={asyncProps.processingHeadline}>
          <span>{asyncProps.processingError}</span>
          {#if displayOption === IMPACT_GEO_KEY_DIFFERENCE}
            <div class="mt-4"><Button variant="secondary" on:click={() => displayOption = IMPACT_GEO_KEY_SIDE_BY_SIDE}>Show side by side</Button></div>
          {/if}
        </Message>
      {:else}
        <Maps bind:isProcessing unit={props.indicator.unit} geographyType={props.geography.geographyType} geoData={asyncProps.geoData} geoShape={asyncProps.geoShape} colorScale={asyncProps.colorScale} {showSatellite} staticMode={chartContext.static} />
      {/if}
    </ChartFrame>
    <LoadingPlaceholder slot="placeholder" />
  </LoadingWrapper>
{:else if mapView.status === 'loading'}
  <LoadingPlaceholder />
{:else if mapView.status === 'failure'}
  {#if mapView.failedRequest === 'indicatorScope'}
    <Message headline="Indicators could not be loaded for this selection">
      <Button class="self-center" variant="secondary" on:click={retryAvailability}>Retry indicators</Button>
    </Message>
  {:else}
    <Message headline="Scenario availability could not be loaded">
      <Button class="self-center" variant="secondary" on:click={retryAvailability}>Retry map scenarios</Button>
    </Message>
  {/if}
{/if}
