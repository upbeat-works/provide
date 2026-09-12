<script>
  import { AVOID_INDICATOR, AVOID_GEOGRAPHY, AVOID_PARAMS, AVOID_TEMPLATE_PROPS, AVOID_IS_EMPTY, AVOID_IS_AVAILABLE } from '$stores/avoid-catalog.js';
  import { SELECTED_LIKELIHOOD_LEVEL, LEVEL_OF_IMPACT } from '$stores/avoid.js';
  import { END_AVOIDING_IMPACTS, KEY_MODEL, KEY_SOURCE, URL_PATH_LEVEL_OF_IMPACT, URL_PATH_CERTAINTY_LEVEL } from '$src/config.js';
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';
  import { fetchData } from '$lib/api/api';
  import ChartFrame from '$lib/components/charts/ChartFrame/ChartFrame.svelte';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import Text from './Text.svelte';
  import { toLegacyAvoidRequest } from '$lib/catalog/translate.js';
  import { sendLegacyAvoidRequest } from '$lib/catalog/legacy-avoid-request.js';

  export let store;
  export let tagline;
  $: legacyParams = toLegacyAvoidRequest({ geography: $AVOID_GEOGRAPHY, indicator: $AVOID_INDICATOR, parameters: $AVOID_PARAMS });

  $: !$AVOID_IS_EMPTY &&
    $AVOID_IS_AVAILABLE &&
    sendLegacyAvoidRequest(fetchData, store, END_AVOIDING_IMPACTS, legacyParams, {
      [URL_PATH_LEVEL_OF_IMPACT]: $LEVEL_OF_IMPACT,
      [URL_PATH_CERTAINTY_LEVEL]: $SELECTED_LIKELIHOOD_LEVEL,
    });

  $: process = ({ thresholdLevelsData }, { scenarios, urlParams }) => {
    const { yearStart, yearStep, data, description, title, [KEY_MODEL]: model, [KEY_SOURCE]: source, parameters } = thresholdLevelsData.data;

    return {
      thresholdLevels: thresholdLevelsData,
      title: 'When will your impact level be exceeded?',
    };
  };
</script>

<LoadingWrapper
  {process}
  let:asyncProps
  let:props
  asyncProps={{
    thresholdLevelsData: $store,
  }}
  props={{
    ...$AVOID_TEMPLATE_PROPS,
  }}
>
  <ChartFrame title={asyncProps.title} {tagline} description={asyncProps.description} chartUid={END_AVOIDING_IMPACTS} templateProps={props} hasDownload={false}>
    <Text data={asyncProps.thresholdLevelsData} />
  </ChartFrame>
  <LoadingPlaceholder slot="placeholder" />
</LoadingWrapper>
