<script>
  import ContentPageLayout from '$lib/components/layouts/ContentPageLayout.svelte';
  import { LABEL_ADAPTATION, PATH_ADAPTATION } from '$config';
  import Publications from './sections/Publications.svelte';

  import SectionDefault from '$lib/components/layouts/ContentPages/SectionDefault.svelte';
  import { kebabCase } from 'lodash-es';
  import Outro from './sections/Outro.svelte';

  export let data;

  $: sections = [
    {
      title: data.introTitle,
      component: SectionDefault,
      content: true,
      props: {
        title: data.introTitle,
        content: data.introText,
      },
    },
    {
      title: data.selfAssessmentTitle,
      component: SectionDefault,
      props: {
        title: data.selfAssessmentTitle,
        content: data.selfAssessmentText,
      },
    },
    {
      title: data.integrationTitle,
      component: SectionDefault,
      content: true,
      props: {
        title: data.integrationTitle,
        content: data.integrationText,
      },
    },
    {
      component: Publications,
      props: {
        title: data.publicationsTitle,
        publications: data.publications,
      },
    },
  ].map((section) => ({ ...section, slug: kebabCase(section.title), content: true }));

</script>

<ContentPageLayout
  {sections}
  dynamicNavigation={true}
  label={LABEL_ADAPTATION}
  title="Tools"
  intro="Tools and resources for using climate data in risk assessment and planning."
>
  <Outro title={data.outroTitle} text={data.outroText} />
</ContentPageLayout>
