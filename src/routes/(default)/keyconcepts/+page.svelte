<script>
  import SectionHeadline from '$lib/components/layouts/ContentPages/SectionHeadline.svelte';
  import TermSection from './components/TermSection.svelte';
  import ContentPageLayout from '$lib/components/layouts/ContentPageLayout.svelte';
  import Scenarios from './components/Scenarios/Scenarios.svelte';
  import ScenariosIntro from './components/Scenarios/ScenariosIntro.svelte';
  import { LABEL_KEY_CONCEPTS, ANCHOR_EXPLAINER_SCENARIOS, LABEL_SCENARIOS_INTRO, LABEL_SCENARIOS_TIMEFRAMES, LABEL_SCENARIOS_PRESETS, LABEL_SCENARIOS_LIST, LABEL_SCENARIOS_TIMELINES } from '$config';
  import { kebabCase } from 'lodash-es';

  export let data;

  $: ({ content, scenarios, selectableTimeframes, defaultTimeframe, scenarioPresets } = data);

  $: sections = [
    ...content.map(({ title, slug, sections }) => ({
      component: SectionHeadline,
      props: {
        slug,
        title,
      },
      sections: sections.map((s) => ({ component: TermSection, props: s })),
    })),
    {
      props: {
        slug: ANCHOR_EXPLAINER_SCENARIOS,
        title: LABEL_SCENARIOS_INTRO,
      },
      component: ScenariosIntro,
      content: true,
      sections: [
        { component: Scenarios, props: { scenarios, selectableTimeframes, defaultTimeframe, scenarioPresets } },
        ...[LABEL_SCENARIOS_TIMEFRAMES, LABEL_SCENARIOS_PRESETS, LABEL_SCENARIOS_LIST, LABEL_SCENARIOS_TIMELINES].map((title) => ({
          props: {
            title,
            content: true,
            slug: kebabCase(title),
          },
        })),
      ],
    },
  ];
</script>

<ContentPageLayout {sections} label={LABEL_KEY_CONCEPTS} title="Learn about the data" intro="Learn more about the methodology used to create the data visualised on this dashboard." />
