<script>
  import { AVOID_INDICATOR, AVOID_GEOGRAPHY, AVOID_PARAMS, AVOID_TEMPLATE_PROPS, AVOID_IS_EMPTY, AVOID_IS_AVAILABLE } from '$stores/avoid-catalog.js';
  import { STUDY_LOCATIONS } from '$stores/meta.js';
  import { LEVEL_OF_IMPACT, SELECTED_LIKELIHOOD_LEVEL_LABEL, SELECTED_LIKELIHOOD_LEVEL, SELECTED_STUDY_LOCATION } from '$stores/avoid.js';
  import { END_AVOIDING_IMPACTS, URL_PATH_LEVEL_OF_IMPACT, URL_PATH_GEOGRAPHY, URL_PATH_INDICATOR, URL_PATH_CERTAINTY_LEVEL } from '$config';
  import LoadingWrapper from '$lib/components/ui/LoadingWrapper.svelte';
  import { fetchData } from '$lib/api/api';
  import { formatValue, formatUnit } from '$lib/utils/formatting';
  import ChartFrame from '$lib/components/charts/ChartFrame/ChartFrame.svelte';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import Locations from './Locations.svelte';
  import Map from './Map.svelte';

  export let store;
  export let tagline;

  $: labelWithinSentence = $AVOID_INDICATOR?.labelWithinSentence ?? $AVOID_INDICATOR?.label;

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

  $: process = ({ thresholdLevelsData }) => {
    const studyLocations = $STUDY_LOCATIONS.map(({ uid, label, order, isAverage }) => {
      const datum = thresholdLevelsData.data.study_locations[uid];
      const { gmt, budget, lat, lng } = datum;
      const isSelected = $SELECTED_STUDY_LOCATION === uid;
      return {
        order,
        label,
        uid,
        gmt,
        budget,
        lat,
        lng,
        isSelected,
        isAverage,
        scenarios: datum.scenarios,
      };
    });

    return {
      studyLocations,
      title: 'How does this vary across the urban environment?',
      description: `For the average over the urban area as well as 6 locations indicated on the map, the table provides the levels to which the world should aim to limit Global Mean Temperature (GMT) so that the probability to exceed the selected level of impact (${formatValue($LEVEL_OF_IMPACT, $AVOID_INDICATOR?.unit?.uid, { matchDecimals: true })} ${labelWithinSentence}) doesn’t go over ${$SELECTED_LIKELIHOOD_LEVEL_LABEL}, as well as the years at which this would happen in the three considered emissions scenarios.`,
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
    <div class="grid gap-x-2 gap-y-6 grid-rows-[auto_auto] lg:grid-cols-[2fr_3fr] items-start">
      <Map studyLocations={asyncProps.studyLocations} />
      <Locations studyLocations={asyncProps.studyLocations} />
    </div>
  </ChartFrame>
  <LoadingPlaceholder slot="placeholder" />
</LoadingWrapper>
