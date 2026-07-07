<script>
  import SectionContent from '$src/lib/components/layouts/SectionContent.svelte';
  import TermSection from './components/TermSection.svelte';
  import ContentPageLayout from '$lib/components/layouts/ContentPageLayout.svelte';
  import Scenarios from './components/Scenarios/Scenarios.svelte';
  import ScenariosIntro from './components/Scenarios/ScenariosIntro.svelte';
  import { LABEL_DOCUMENTATION, ANCHOR_EXPLAINER_SCENARIOS, LABEL_SCENARIOS_INTRO, LABEL_SCENARIOS_TIMEFRAMES, LABEL_SCENARIOS_PRESETS, LABEL_SCENARIOS_LIST, LABEL_SCENARIOS_TIMELINES } from '$config';
  import { tabItems } from '../tabs.js';
  import { kebabCase } from 'lodash-es';

  export let data;

  $: ({ content, scenarios, selectableTimeframes, defaultTimeframe, scenarioPresets } = data);

  $: sections = [
    ...content.map(({ title, slug, sections }) => ({
      component: SectionContent,
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

<ContentPageLayout {sections} {tabItems} label={LABEL_DOCUMENTATION} title="How our data is built" intro="From models to impact definitions and processing, this section shows how the dashboard is built and how to read it." />
