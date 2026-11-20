<script>
  import { AVOID_TEMPLATE_PROPS } from '$stores/avoid-catalog.js';
  import { END_AVOIDING_IMPACTS, KEY_MODEL, KEY_SOURCE } from '$src/config.js';
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';
  import ChartFrame from '$lib/components/charts/ChartFrame/ChartFrame.svelte';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import Text from './Text.svelte';

  export let store;
  export let tagline;
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
