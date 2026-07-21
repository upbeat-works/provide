<script>
  import { AVOID_INDICATOR, AVOID_GEOGRAPHY, AVOID_PARAMS, AVOID_TEMPLATE_PROPS, AVOID_IS_EMPTY, AVOID_IS_AVAILABLE } from '$stores/avoid-catalog.js';
  import { SELECTED_LIKELIHOOD_LEVEL, LEVEL_OF_IMPACT } from '$stores/avoid.js';
  import { END_AVOIDING_IMPACTS, KEY_MODEL, KEY_SOURCE, URL_PATH_GEOGRAPHY, URL_PATH_INDICATOR, URL_PATH_LEVEL_OF_IMPACT, URL_PATH_CERTAINTY_LEVEL } from '$src/config.js';
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';
  import { fetchData } from '$lib/api/api';
  import ChartFrame from '$lib/components/charts/ChartFrame/ChartFrame.svelte';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import Text from './Text.svelte';

  export let store;
  export let tagline;

  $: !$AVOID_IS_EMPTY &&
    $AVOID_IS_AVAILABLE &&
    fetchData(store, {
      endpoint: END_AVOIDING_IMPACTS,
      params: {
        [URL_PATH_GEOGRAPHY]: $AVOID_GEOGRAPHY.uid,
        [URL_PATH_INDICATOR]: $AVOID_INDICATOR.uid,
        [URL_PATH_LEVEL_OF_IMPACT]: $LEVEL_OF_IMPACT,
        [URL_PATH_CERTAINTY_LEVEL]: $SELECTED_LIKELIHOOD_LEVEL,
        ...$AVOID_PARAMS,
      },
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
