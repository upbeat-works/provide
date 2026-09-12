<script>
  import SectionContent from '$src/lib/components/layouts/SectionContent.svelte';
  import TermSection from './components/TermSection.svelte';
  import ContentPageLayout from '$lib/components/layouts/ContentPageLayout.svelte';
  import ScenariosIntro from './components/Scenarios/ScenariosIntro.svelte';
  import ScenarioExplainer from './components/ScenarioExplainer.svelte';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import {
    LABEL_DOCUMENTATION,
    ANCHOR_EXPLAINER_SCENARIOS,
    LABEL_SCENARIOS_INTRO,
    LABEL_SCENARIOS_TIMEFRAMES,
    LABEL_SCENARIOS_PRESETS,
    LABEL_SCENARIOS_LIST,
    LABEL_SCENARIOS_TIMELINES,
  } from '$config';
  import { tabItems } from '../tabs.js';
  import { kebabCase } from 'lodash-es';

  export let data;
  $: data.explainer.catch(() => {});

  const pageProps = {
    tabItems,
    label: LABEL_DOCUMENTATION,
    title: 'How our data is built',
    intro: 'From models to impact definitions and processing, this section shows how the dashboard is built and how to read it.',
  };

  function buildSections(glossary, explainer) {
    return [
      ...glossary.content.map(({ title, slug, sections }) => ({
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
          { component: ScenarioExplainer, props: { promise: explainer } },
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
  }
</script>

{#await data.glossary}
  <ContentPageLayout sections={[]} {...pageProps}>
    <LoadingPlaceholder />
  </ContentPageLayout>
{:then glossary}
  <ContentPageLayout sections={buildSections(glossary, data.explainer)} {...pageProps} />
{:catch}
  <ContentPageLayout sections={[]} {...pageProps}>
    <div class="py-16 text-center text-sm text-text-weaker" role="alert">Content could not be loaded. Try again in a moment.</div>
  </ContentPageLayout>
{/await}
