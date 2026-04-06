<script>
  import ContentPageLayout from '$lib/components/layouts/ContentPageLayout.svelte';
  import { LABEL_ADAPTATION } from '$config';
  import Publications from './sections/Publications.svelte';
  import Outro from './sections/Outro.svelte';
  import SectionContent from '$src/lib/components/layouts/SectionContent.svelte';
  import { kebabCase } from 'lodash-es';

  export let data;

  $: sections = [
    {
      title: data.introTitle,
      component: SectionContent,
      content: true,
      props: {
        title: data.introTitle,
        content: data.introText,
      },
    },
    {
      title: data.selfAssessmentTitle,
      component: SectionContent,
      props: {
        title: data.selfAssessmentTitle,
        content: data.selfAssessmentText,
      },
    },
    {
      title: data.integrationTitle,
      component: SectionContent,
      content: true,
      props: {
        title: data.integrationTitle,
        content: data.integrationText,
      },
    },
    {
      component: SectionContent,
      props: {
        title: data.publicationsTitle,
        slug: 'publications',
      },
      sections: [
        {
          component: Publications,
          props: {
            publications: data.publications,
          },
        },]
    },
  ].map((section) => ({ ...section, slug: kebabCase(section.title), content: true }));
</script>

<ContentPageLayout
  {sections}
  label={LABEL_ADAPTATION}
  title="Tools"
  intro="Tools and resources for using climate data in risk assessment and planning."
>
  <Outro title={data.outroTitle} text={data.outroText} />
</ContentPageLayout>
